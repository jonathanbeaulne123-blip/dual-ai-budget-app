import {WinMemorySource} from './WinMemorySource.tsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MemoryComposition } from './contracts.ts';
import type { ThemeId } from '../theme/scenes.ts';
import { amountForMemory, captureProjectorSelection, checkProjectorCurrent, keptCompositions, memoryKey, prepareProjector, projectorDownloadProof, validateProjectorDownload } from './projectorComposition.ts';
import { buildProjectorPages, paintProjectorPage, type ProjectorPage } from './projectorCanvas.ts';
import { recordProjectorFilm, supportedProjectorMime } from './projectorFilm.ts';
import { createProjectorStory } from './projectorStory.ts';
import { projectorDraftKey, readProjectorDraft, writeProjectorDraft, type ProjectorDraftScope, type ProjectorDraftStore } from './projectorDraft.ts';
import type { PreparedProjector, ProjectorAmountSnapshot, ProjectorFile, ProjectorLoaders, ProjectorOptions, ProjectorDownloadProof, ProjectorDownloadValidator } from './projectorTypes.ts';
import './theatreProjector.css';

export type TheatreProjectorProps = ProjectorLoaders & {
  memories: MemoryComposition[]; activeMemberIds: string[]; theme: ThemeId;
  /** Change on environment, household, member or access-epoch changes. */
  scopeKey: string; publicationEpoch?: string | number;
  draftScope: ProjectorDraftScope; draftStorage?: ProjectorDraftStore;
  authorLabels?: Record<string, string>; amountSnapshots?: ProjectorAmountSnapshot[];
  validateDownload: ProjectorDownloadValidator;
  onReviewMemory?: (memoryId: string, revision: number) => void;
  onClose: () => void;
};
function ProjectorMechanism() {
  return <svg viewBox="0 0 300 160" aria-hidden="true" className="htp-machine"><path d="M64 130L50 155M173 130L191 155" stroke="currentColor" strokeWidth="12"/><path d="M32 73H213V132H32Z" fill="var(--htp-metal)" stroke="currentColor" strokeWidth="3"/><path d="M211 85H248L274 74V132L248 120H211Z" fill="var(--htp-accent)" stroke="currentColor" strokeWidth="3"/>{[76,164].map(x=><g key={x} className="htp-reel" style={{transformOrigin:`${x}px 51px`}}><circle cx={x} cy="51" r="41" fill="var(--htp-paper)" stroke="currentColor" strokeWidth="5"/><circle cx={x} cy="51" r="8" fill="currentColor"/>{[0,1,2,3,4].map(i=><circle key={i} cx={x+Math.cos(i*Math.PI*.4)*24} cy={51+Math.sin(i*Math.PI*.4)*24} r="8" fill="var(--htp-metal)" stroke="currentColor" strokeWidth="1.5"/>)}</g>)}<path d="M60 94H168M60 104H168M60 114H141" stroke="currentColor" opacity=".45" strokeWidth="3"/></svg>;
}
function projectorDraftStore(explicit?: ProjectorDraftStore): { storage: ProjectorDraftStore | null; warning: string } {
  if (explicit) return { storage: explicit, warning: '' };
  if (typeof window === 'undefined') return { storage: null, warning: '' };
  try { return { storage: window.localStorage, warning: '' }; } catch { return { storage: null, warning: 'Reel choices are only in this visit. This device could not open local draft storage.' }; }
}
export function TheatreProjector(props: TheatreProjectorProps) {
  return <TheatreProjectorScoped key={projectorDraftKey(props.draftScope)} {...props}/>;
}
function TheatreProjectorScoped(props: TheatreProjectorProps) {
  const id = useId(), eligible = keptCompositions(props.memories, props.activeMemberIds);
  const [draftAccess] = useState(() => projectorDraftStore(props.draftStorage)), storage = draftAccess.storage;
  const [recovery] = useState(() => { try { return { value: storage ? readProjectorDraft(storage, props.draftScope, eligible) : null, warning: draftAccess.warning }; } catch { return { value: null, warning: 'Reel choices are only in this visit. This device could not read the saved reel.' }; } });
  const restored = recovery.value;
  const [order, setOrder] = useState<string[]>(() => restored?.status === 'restored' || restored?.status === 'rejected' ? restored.order : eligible[0] ? [memoryKey(eligible[0])] : []);
  const [seconds, setSeconds] = useState(restored?.secondsPerPage ?? 5), [showAmounts, setShowAmounts] = useState(restored?.showAmounts ?? false);
  const [prepared, setPrepared] = useState<{ stamp: string; value: PreparedProjector } | null>(null), [pageIndex, setPageIndex] = useState(0), [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<'load' | 'film' | 'story' | 'download' | null>(null), [message, setMessage] = useState(''), [progress, setProgress] = useState(0);
  const [file, setFile] = useState<{ stamp: string; value: ProjectorFile; proof: ProjectorDownloadProof } | null>(null), [fileUrl, setFileUrl] = useState(''), [audioUrl, setAudioUrl] = useState('');
  const [filmSupported, setFilmSupported] = useState(false), [reduced, setReduced] = useState(false), [mechanismVisible, setMechanismVisible] = useState(false);
  const [draftNotice, setDraftNotice] = useState(() => {
    if (recovery.warning) return recovery.warning;
    if (restored?.status === 'rejected') return 'The saved reel could not be recovered. No memories were selected.';
    return restored?.discarded ? 'A selected memory changed or is no longer available, so it was left off this reel.' : '';
  });
  const heading = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null), audio = useRef<HTMLAudioElement>(null), loadAbort = useRef<AbortController | null>(null), exportAbort = useRef<AbortController | null>(null);
  const options: ProjectorOptions = { theme: props.theme, secondsPerPage: seconds, showAmounts, amountSnapshots: props.amountSnapshots, authorLabels: props.authorLabels };
  const eligibleKeys = eligible.map(memoryKey), chosen = order.filter(key => eligibleKeys.includes(key)), chosenStamp = JSON.stringify(chosen);
  const chosenMemories = chosen.map(key => eligible.find(memory => memoryKey(memory) === key)!).filter(Boolean);
  const sourceStamp = JSON.stringify([props.scopeKey, props.publicationEpoch, props.activeMemberIds, eligible]);
  const stamp = JSON.stringify([sourceStamp, chosen, options]), liveStamp = useRef(stamp); liveStamp.current = stamp;
  const active = prepared?.stamp === stamp ? prepared.value : null;
  const pages = useMemo(() => { if (!active || typeof document === 'undefined') return []; const ctx = document.createElement('canvas').getContext('2d'); if (!ctx) return []; ctx.font = '22px Georgia'; return buildProjectorPages(active, text => ctx.measureText(text).width); }, [active]);
  const page: ProjectorPage | undefined = pages[Math.min(pageIndex, pages.length - 1)];
  const operationBusy = busy === 'film' || busy === 'story' || busy === 'download';
  useEffect(() => { setFilmSupported(Boolean(supportedProjectorMime()) && typeof HTMLCanvasElement.prototype.captureStream === 'function'); const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { const node = heading.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => setMechanismVisible(Boolean(entry?.isIntersecting))); observer.observe(node); return () => observer.disconnect(); }, []);
  useEffect(() => { const next = order.filter(key => eligibleKeys.includes(key)); if (next.length === order.length) return; setOrder(next); setDraftNotice('A selected memory changed or is no longer available, so it was left off this reel.'); }, [sourceStamp, order]);
  useEffect(() => { if (!storage) return; try { writeProjectorDraft(storage, props.draftScope, chosenMemories, { secondsPerPage: seconds, showAmounts }); } catch { setDraftNotice('Reel choices are only in this visit. This device could not save the reel.'); } }, [storage, props.draftScope.environment, props.draftScope.householdId, props.draftScope.memberId, props.draftScope.audience, chosenStamp, seconds, showAmounts, sourceStamp]);
  useEffect(() => {
    const controller = new AbortController(); loadAbort.current = controller; exportAbort.current?.abort(); exportAbort.current = null; setFile(null); setPlaying(false); setMessage('');
    if (!chosen.length) { setPrepared(null); setBusy(null); return () => controller.abort(); }
    setBusy('load'); const guard = { signal: controller.signal, isCurrent: () => liveStamp.current === stamp };
    void (async () => { try { const selection = captureProjectorSelection(props.memories, props.activeMemberIds, chosen, options); const value = await prepareProjector(selection, props.scopeKey, props, guard); checkProjectorCurrent(guard); setPrepared({ stamp, value }); setPageIndex(index => Math.min(index, buildProjectorPages(value, text => text.length * 12).length - 1)); setBusy(null); } catch (error) { if (!controller.signal.aborted && liveStamp.current === stamp) { setPrepared(null); setBusy(null); setMessage(error instanceof Error && error.message === 'PROJECTOR_TOTAL_MEDIA_LIMIT' ? 'This selection has more media than this device can prepare at once. Choose a smaller set.' : 'This version could not be prepared. Your kept memories have not changed.'); } } })();
    return () => controller.abort();
  }, [stamp]);
  useEffect(() => {
    if (!active || !page || !canvas.current) return;
    const target = canvas.current; let cancelled = false;
    const rendered = document.createElement('canvas');
    void paintProjectorPage(rendered, page, active).then(() => { if (!cancelled && canvas.current === target && liveStamp.current === stamp) { target.width = rendered.width; target.height = rendered.height; target.getContext('2d')?.drawImage(rendered, 0, 0); } rendered.width = 0; }).catch(() => { if (!cancelled) { setPlaying(false); setMessage('This saved image could not be drawn here. Its exact source remains in the story file.'); } });
    return () => { cancelled = true; };
  }, [active, page]);
  useEffect(() => {
    if (page?.asset?.kind !== 'audio' || page.asset.status !== 'available' || !page.asset.blob) { setAudioUrl(''); return; }
    const url = URL.createObjectURL(page.asset.blob); setAudioUrl(url);
    return () => { const node = audio.current; node?.pause(); if (node) { node.removeAttribute('src'); node.load(); } URL.revokeObjectURL(url); };
  }, [page]);
  useEffect(() => { const node = audio.current; return () => { node?.pause(); if (node) { node.removeAttribute('src'); node.load(); } }; }, [audioUrl]);
  useEffect(() => {
    if (!file || file.stamp !== stamp) { setFileUrl(''); return; }
    const url = URL.createObjectURL(file.value.blob); setFileUrl(url); return () => URL.revokeObjectURL(url);
  }, [file, stamp]);
  useEffect(() => {
    if (!playing || !page) { audio.current?.pause(); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = () => { if (pageIndex + 1 >= pages.length) setPlaying(false); else setPageIndex(index => index + 1); };
    const node = audio.current;
    if (audioUrl && node) { if (node.ended) node.currentTime = 0; void node.play().catch(() => { setPlaying(false); setMessage('Use the voice-note Play control to hear this recording.'); }); node.addEventListener('ended', advance, { once: true }); }
    else timer = setTimeout(advance, seconds * 1000);
    return () => { if (timer) clearTimeout(timer); node?.removeEventListener('ended', advance); node?.pause(); };
  }, [playing, page, pageIndex, pages.length, seconds, audioUrl]);
  useEffect(() => () => { loadAbort.current?.abort(); exportAbort.current?.abort(); }, []);
  function close() { loadAbort.current?.abort(); exportAbort.current?.abort(); audio.current?.pause(); setPlaying(false); setFile(null); setPrepared(null); props.onClose(); }
  function cancel() { exportAbort.current?.abort(); setPlaying(false); setMessage('Cancelled. No partial film was saved.'); }
  function move(key: string, direction: number) { setOrder(previous => { const next = [...previous], index = next.indexOf(key), target = index + direction; if (index < 0 || target < 0 || target >= next.length) return previous; [next[index], next[target]] = [next[target]!, next[index]!]; return next; }); }
  async function createFile(kind: 'film' | 'story') {
    if (!chosen.length || operationBusy) return;
    const controller = new AbortController(); exportAbort.current?.abort(); exportAbort.current = controller; setPlaying(false); setFile(null); setProgress(0); setBusy(kind); setMessage('');
    const guard = { signal: controller.signal, isCurrent: () => liveStamp.current === stamp };
    let backgrounded = false; const hidden = () => { if (document.hidden) { backgrounded = true; controller.abort(); } }; document.addEventListener('visibilitychange', hidden); hidden();
    // A dedicated context is resumed in the user's gesture, then closed by the recorder on every path.
    let audioContext: AudioContext | undefined;
    const stopDedicatedAudio = () => { if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => {}); };
    controller.signal.addEventListener('abort', stopDedicatedAudio, { once: true });
    try {
      if (kind === 'film' && eligible.some(memory => chosen.includes(memoryKey(memory)) && memory.media.some(media => media.kind === 'audio')) && typeof AudioContext !== 'undefined') {
        try { audioContext = new AudioContext(); void audioContext.resume().catch(() => {}); } catch { /* The recorder handles unavailable audio with the readable-story fallback. */ }
      }
      const selection = captureProjectorSelection(props.memories, props.activeMemberIds, chosen, options);
      const value = await prepareProjector(selection, props.scopeKey, props, guard); checkProjectorCurrent(guard);
      let result: ProjectorFile;
      if (kind === 'film') {
        try { result = await recordProjectorFilm(value, guard, setProgress, audioContext); }
        catch (error) { checkProjectorCurrent(guard); if (error instanceof DOMException && error.name === 'AbortError') throw error; result = await createProjectorStory(value, guard); setMessage('A film could not be recorded here. The complete readable story file is ready instead.'); }
      } else result = await createProjectorStory(value, guard);
      const proof = await projectorDownloadProof(value, guard); checkProjectorCurrent(guard); setFile({ stamp, value: result, proof }); if (result.kind === 'film') setMessage('Your film is ready to download.');
    } catch (error) {
      if (liveStamp.current === stamp) setMessage(backgrounded ? 'Export stopped when the theatre was hidden. Return here and try again.' : controller.signal.aborted || error instanceof DOMException && error.name === 'AbortError' ? 'Cancelled. No partial film was saved.' : 'The export could not finish. Your selected memories have not changed.');
    } finally { document.removeEventListener('visibilitychange', hidden); controller.signal.removeEventListener('abort', stopDedicatedAudio); if (audioContext && audioContext.state !== 'closed') await audioContext.close(); if (exportAbort.current === controller) { exportAbort.current = null; setBusy(null); } }
  }
  async function downloadFile() {
    if (!file || file.stamp !== stamp || !fileUrl || operationBusy) return;
    const candidate = file, url = fileUrl, controller = new AbortController(); exportAbort.current?.abort(); exportAbort.current = controller; setBusy('download'); setMessage('Checking access to these kept versions…');
    const guard = { signal: controller.signal, isCurrent: () => liveStamp.current === stamp };
    try {
      await validateProjectorDownload(candidate.proof, props.scopeKey, props.validateDownload, guard); checkProjectorCurrent(guard);
      const link = document.createElement('a'); link.href = url; link.download = candidate.value.filename; document.body.append(link); link.click(); link.remove(); setMessage('Download started.');
    } catch { if (liveStamp.current === stamp) { setFile(null); setMessage('Access could not be verified. Reconnect and create the story again before downloading.'); } }
    finally { if (exportAbort.current === controller) { exportAbort.current = null; setBusy(null); } }
  }
  const canShowAmounts = eligible.some(memory => chosen.includes(memoryKey(memory)) && props.amountSnapshots?.some(row => row.memoryId === memory.id && row.memoryRevision === memory.revision) && !memory.hideAmounts);
  return <section className="htp" data-theme={props.theme} data-playing={playing && !reduced && mechanismVisible} aria-labelledby={`${id}-title`} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); if (operationBusy) cancel(); else close(); return; }
    if ((event.target as HTMLElement).closest('button,input,select,textarea,a,audio')) return;
    if (event.key === ' ') { event.preventDefault(); setPlaying(value => !value); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setPlaying(false); setPageIndex(index => Math.min(pages.length - 1, index + 1)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); setPlaying(false); setPageIndex(index => Math.max(0, index - 1)); }
  }}>
    <header className="htp-heading" ref={heading}><div><p>THE THINGS WE KEEP</p><h2 id={`${id}-title`}>Our little theatre</h2><span>Two voices. A story only we could keep.</span></div><button type="button" onClick={close}>Close theatre</button><ProjectorMechanism/></header>
    <div className="htp-booth"><div className="htp-curtain htp-curtain-left" aria-hidden="true"/><div className="htp-curtain htp-curtain-right" aria-hidden="true"/><div className="htp-beam" aria-hidden="true"/><div className="htp-screen">
      {active && page ? <canvas ref={canvas} width="1280" height="720" tabIndex={0} role="img" aria-label={`${page.memory.title}. Page ${page.page} of ${page.pages}. Full captions below.`} aria-keyshortcuts="Space ArrowLeft ArrowRight"/> : <div className="htp-screen-empty"><span aria-hidden="true">✧</span><h3>{busy === 'load' ? 'Setting out our story…' : eligible.length ? 'Choose what we will revisit.' : 'A little space for what we keep.'}</h3><p>{eligible.length ? 'Select a mutually kept version below. The projector preserves each person’s own words.' : 'Memories will appear after everyone has chosen to keep the same composition.'}</p></div>}
    </div><div className="htp-footlights" aria-hidden="true"/></div>
    <div className="htp-transport"><button type="button" disabled={!page || pageIndex <= 0 || operationBusy} onClick={() => { setPlaying(false); setPageIndex(index => index - 1); }}>← Previous</button><button type="button" className="htp-play" disabled={!page || operationBusy} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause story' : 'Play story'}</button><button type="button" disabled={!page || pageIndex >= pages.length - 1 || operationBusy} onClick={() => { setPlaying(false); setPageIndex(index => index + 1); }}>Next →</button><span>{pages.length ? `${Math.min(pageIndex + 1, pages.length)} / ${pages.length} pages` : 'Ready when we are'}</span></div>
    {audioUrl && page?.asset?.kind === 'audio' && <div className="htp-audio"><label htmlFor={`${id}-audio`}>The kept voice note</label><audio id={`${id}-audio`} ref={audio} src={audioUrl} controls preload="metadata"/></div>}
    {active && page && <section className="htp-caption-copy" aria-label="The complete kept captions"><header><div><small>KEPT VERSION {page.memory.revision}{page.memory.date ? ` · ${page.memory.date}` : ''}</small><h3>{page.memory.title}</h3></div>{props.onReviewMemory && <button type="button" onClick={() => props.onReviewMemory!(page.memory.id, page.memory.revision)}>Review our captions</button>}</header><WinMemorySource source={page.memory.legacySource} history={false}/><div>{page.memory.recollections.map(row => <article key={row.memberId}><h4>{props.authorLabels?.[row.memberId] || `Voice ${page.memory.recollections.indexOf(row) + 1}`}</h4><p>{row.text || 'No caption was added to this kept version.'}</p></article>)}</div>{amountForMemory(active.selection, page.memory) && <p className="htp-amount">{amountForMemory(active.selection, page.memory)!.provenance} · kept {amountForMemory(active.selection, page.memory)!.asOf}</p>}</section>}
    <div className="htp-desk"><section className="htp-selection" aria-label="Choose and order memories"><header><div><small>SET OUT OUR REEL</small><h3>The order we remember</h3></div><span>{chosen.length} chosen</span></header><ol>{[...chosen.map(key => eligible.find(memory => memoryKey(memory) === key)!).filter(Boolean), ...eligible.filter(memory => !chosen.includes(memoryKey(memory)))].map(memory => { const key = memoryKey(memory), index = chosen.indexOf(key); return <li key={key}><label><input type="checkbox" checked={index >= 0} disabled={operationBusy} onChange={event => setOrder(previous => event.target.checked ? [...previous, key] : previous.filter(item => item !== key))}/><span><strong>{memory.title}</strong><small>{memory.date || 'A moment we kept'} · version {memory.revision}</small></span></label>{index >= 0 && <div><button type="button" disabled={index === 0 || operationBusy} aria-label={`Move ${memory.title} earlier`} onClick={() => move(key, -1)}>↑</button><button type="button" disabled={index === chosen.length - 1 || operationBusy} aria-label={`Move ${memory.title} later`} onClick={() => move(key, 1)}>↓</button></div>}</li>; })}</ol>{!eligible.length && <p>There are no mutually kept versions to project yet.</p>}</section>
      <section className="htp-export" aria-labelledby={`${id}-export`}><small>TAKE OUR STORY WITH US</small><h3 id={`${id}-export`}>A film to keep</h3><p>Our chosen moments, saved artwork and each person’s own words, in the order we choose.</p><label htmlFor={`${id}-seconds`}>Seconds per page<input id={`${id}-seconds`} type="number" min="1" max="30" value={seconds} disabled={operationBusy} onChange={event => { const value = Number(event.target.value); if (value >= 1 && value <= 30) setSeconds(value); }}/></label><p className="htp-help">Voice notes play in full. Longer captions continue onto more pages.</p>{canShowAmounts && <label className="htp-check"><input type="checkbox" checked={showAmounts} disabled={operationBusy} onChange={event => setShowAmounts(event.target.checked)}/>Include the explicitly kept amounts</label>}<div className="htp-export-actions"><button type="button" disabled={!active || operationBusy || !filmSupported} onClick={() => void createFile('film')}>Create film</button><button type="button" disabled={!active || operationBusy} onClick={() => void createFile('story')}>Create story file</button></div>{!filmSupported && <p className="htp-help">Video recording is unavailable here. The readable story file keeps the chosen words and media.</p>}{operationBusy && <div className="htp-progress"><label htmlFor={`${id}-progress`}>{busy === 'film' ? 'Recording our film' : busy === 'download' ? 'Checking access to our story' : 'Preparing our story'}</label><progress id={`${id}-progress`} max="1" value={busy === 'film' ? progress : undefined}/><button type="button" onClick={cancel}>Cancel export</button></div>}{file?.stamp === stamp && fileUrl && <button type="button" className="htp-download" disabled={operationBusy} onClick={() => void downloadFile()}>Download {file.value.kind === 'film' ? 'film' : 'readable story file'}</button>}</section></div>
    <p className="htp-status" role="status">{message || draftNotice}</p>
  </section>;
}
