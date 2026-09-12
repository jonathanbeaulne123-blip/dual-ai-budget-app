import {WinMemorySource} from './WinMemorySource.tsx';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { VaultClientScope } from './vaultClient.ts';
import { type VaultMailCard, type VaultMedia, vaultAssert } from './vaultContracts.ts';
import { memoryCompositionDigest, type MemoryPublicationBinding, type MemoryPublicationCandidate, type VaultMemoryAuthorReview } from './memoryPublication.ts';
import { IndexedDbMemoryPublicationRecovery, activateMemoryReview, approveMemoryReview, copyMemoryMedia, memoryPrivateScope, prepareMemoryReview, withdrawMemoryReview,
  type MemoryCopySource, type MemoryPublicationRecovery, type MemoryRecoveryEntry, type MemoryVaultClient } from './memoryPublicationClient.ts';
import { normalizeLetterPhoto } from './lettersMedia.ts';
import './memory-publication.css';

export type MemoryPublicationProps = {
  client: MemoryVaultClient; scope: VaultClientScope; theme: 'classic' | 'taylor' | 'newfoundland';
  candidate: MemoryPublicationCandidate; roster: { memberId: string; name: string; active?: boolean }[];
  editable?: boolean; enabled?: boolean; artwork?: ReactNode;
  onChange: (candidate: MemoryPublicationCandidate) => void;
  /** Canonical callbacks must recognize an already accepted same-binding retry. */
  compose: (candidate: MemoryPublicationCandidate) => Promise<boolean>;
  keep: (binding: MemoryPublicationBinding) => Promise<boolean>;
  withdraw: (binding: MemoryPublicationBinding) => Promise<boolean>;
  onActivated?: () => void; recovery?: MemoryPublicationRecovery; normalizePhoto?: typeof normalizeLetterPhoto;
};
function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (/PRIVATE_STORAGE|PRIVATE_UPLOAD_QUEUE/.test(code)) return 'This device could not keep the pending review. Free some device space and retry; nothing new was shared.';
  if (/MEMORY_CHANGED|COMPOSITION_CHANGED|AUDIENCE_CHANGED|APPROVAL_REQUIRED/.test(code)) return 'This memory or its audience changed. Refresh and review the exact current version before keeping it.';
  if (/UNAUTHENTICATED|FORBIDDEN|SCOPE_CHANGED/.test(code)) return 'Sign in to the selected household again. This draft stays with its original account.';
  if (/NOT_FOUND|REVOKED|MEDIA_UNAVAILABLE|MEDIA_ID_REUSED/.test(code)) return 'That source is no longer available. An already accepted separate copy stays with its own memory.';
  if (/DISABLED|NOT_ACTIVATED|MEMORY_REVIEW_REQUIRED/.test(code)) return 'Shared memory publication is not available here yet. Your draft is still here.';
  if (/IMAGE|SOURCE_TOO_LARGE|MEDIA_TOO_LARGE/.test(code)) return 'Choose a JPEG, PNG or WebP photo under 10 MB. Its metadata will be removed before upload.';
  return 'That did not finish. The same pending copy or review is kept; try again when your connection is ready.';
}
const sameBinding = (a?: MemoryPublicationBinding, b?: MemoryPublicationBinding) => JSON.stringify(a) === JSON.stringify(b);

export function MemoryPublication(props: MemoryPublicationProps) {
  return <MemoryPublicationSurface key={`${memoryPrivateScope(props.scope)}/${props.candidate.id}`} {...props}/>;
}
function MemoryPublicationSurface({ client, scope, theme, candidate, roster, editable = false, enabled = true, artwork,
  onChange, compose, keep, withdraw, onActivated, recovery: suppliedRecovery, normalizePhoto = normalizeLetterPhoto }: MemoryPublicationProps) {
  const id = useId(), live = useRef(true), current = useRef(candidate); current.current = candidate;
  const [review, setReview] = useState<VaultMemoryAuthorReview | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('');
  const [letters, setLetters] = useState<VaultMailCard[] | null>(null), [sources, setSources] = useState<MemoryCopySource[]>([]), [selected, setSelected] = useState<MemoryCopySource | null>(null);
  const [recoveries, setRecoveries] = useState<MemoryRecoveryEntry[]>([]), [withdrawing, setWithdrawing] = useState(false);
  const [exact, setExact] = useState(false), reviewHeading = useRef<HTMLHeadingElement>(null);
  const copyHeading = useRef<HTMLHeadingElement>(null), copyReturn = useRef<HTMLButtonElement | null>(null), lettersButton = useRef<HTMLButtonElement>(null);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const recovery = useMemo<MemoryPublicationRecovery>(() => {
    try { return suppliedRecovery ?? new IndexedDbMemoryPublicationRecovery(); }
    catch { const fail = async (): Promise<never> => { throw new Error('PRIVATE_STORAGE_UNAVAILABLE'); }; return { reserve: fail, list: fail }; }
  }, [suppliedRecovery]);
  const name = (memberId: string) => roster.find(m => m.memberId === memberId)?.name ?? 'Household member';
  const binding = candidate.publication;
  const loadRecovery = async () => { const rows = await recovery.list(scope, current.current.id); if (live.current) setRecoveries(rows); };
  const refresh = async () => {
    const selectedBinding = current.current.publication;
    if (!selectedBinding) return;
    const value = await client.command({ operation: 'review-memory', id: selectedBinding.publicationId }) as VaultMemoryAuthorReview;
    vaultAssert(sameBinding(value.binding, selectedBinding) && await memoryCompositionDigest(value.memory.composition) === selectedBinding.compositionDigest, 'COMPOSITION_CHANGED');
    if (live.current) { setReview(value); setProposalAccepted(true); }
  };
  useEffect(() => {
    live.current = true; void loadRecovery().catch(e => { if (live.current) setError(errorMessage(e)); });
    return () => { live.current = false; if (!suppliedRecovery) void Promise.resolve().then(() => { if (!live.current) return recovery.close?.(); }); };
    // The keyed surface is one private account/household/memory generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, recovery]);
  useEffect(() => {
    let cancelled = false; setExact(false);
    void memoryCompositionDigest(candidate).then(digest => {
      if (!cancelled) setExact(Boolean(binding && binding.compositionDigest === digest && binding.memoryRevision === candidate.revision));
    });
    return () => { cancelled = true; };
  }, [candidate, binding]);
  useEffect(() => {
    if (!exact || !binding) { setReview(null); setProposalAccepted(false); return; }
    let cancelled = false;
    void client.command({ operation: 'review-memory', id: binding.publicationId }).then(value => {
      const r = value as VaultMemoryAuthorReview; vaultAssert(sameBinding(r.binding, binding), 'COMPOSITION_CHANGED');
      if (!cancelled) { setReview(r); setProposalAccepted(true); setError(''); }
    }).catch(e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [exact, binding?.publicationId, binding?.publicationDigest, client]);
  useEffect(() => { if (selected) copyHeading.current?.focus(); }, [selected?.mediaId, selected?.publicationId]);
  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return; setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (e) { if (live.current) setError(errorMessage(e)); }
    finally { if (live.current) { setBusy(''); void loadRecovery().catch(() => {}); } }
  };
  const addCopy = async (source: MemoryCopySource) => {
    const media = await copyMemoryMedia(client, recovery, scope, current.current.id, source);
    if (!live.current) return;
    const value = current.current; onChange({ ...value, media: [...value.media.filter(m => m.contentId !== media.contentId), media] });
    setSelected(null); setNotice('A separate copy is in your draft. We each review the resulting memory before keeping it.');
  };
  const upload = async (file: File) => {
    const attachment = await normalizePhoto(file); if (!live.current) return;
    await client.queueMedia({ id: attachment.id, sha256: attachment.sha256, byteLength: attachment.byteLength, contentType: attachment.contentType }, attachment.blob);
    await client.resumeUploads([attachment.id]); if (!live.current) return;
    const value = current.current; onChange({ ...value, media: [...value.media, { version: 1, contentId: attachment.id, revision: 1, kind: 'image', alt: 'A photo we chose to keep' }] });
    setNotice('Your photo is privately uploaded with its original metadata removed.');
  };
  const prepare = async () => {
    setProposalAccepted(false);
    const value = current.current, r = await prepareMemoryReview(client, recovery, scope, value, roster.filter(m => m.active !== false).map(m => m.memberId));
    if (!live.current) return;
    vaultAssert(await memoryCompositionDigest(current.current) === r.binding.compositionDigest, 'COMPOSITION_CHANGED');
    const prepared = { ...value, publication: r.binding }; onChange(prepared); setReview(r);
    vaultAssert(await compose(prepared), 'MEMORY_COMPOSE_UNCERTAIN');
    if (live.current) { setProposalAccepted(true); setNotice('This exact composition is ready for each of us to review and keep.'); reviewHeading.current?.focus(); }
  };
  const mineKept = candidate.approvals.some(a => a.memberId === scope.memberId && a.revision === candidate.revision);
  const allKept = roster.filter(m => m.active !== false).length >= 2 && roster.filter(m => m.active !== false).every(m => candidate.approvals.some(a => a.memberId === m.memberId && a.revision === candidate.revision));
  const blocked = Boolean(busy) || !enabled;
  if (candidate.withdrawn) return <section className="memory-publication" data-theme={theme} aria-label="Withdrawn memory"><p role="status">This shared copy has been withdrawn.</p></section>;
  return <section className="memory-publication" data-theme={theme} aria-labelledby={`${id}-title`} aria-busy={Boolean(busy)}>
    <header><span className="memory-publication-mark" aria-hidden="true">{theme === 'taylor' ? '✿' : theme === 'newfoundland' ? '≈' : '✦'}</span>
      <div><p className="memory-publication-kicker">{theme === 'taylor' ? 'Our keepsake pages' : theme === 'newfoundland' ? 'Something to bring home' : 'A place for this moment'}</p>
        <h3 id={`${id}-title`}>Photos, voices, and our own words</h3></div></header>
    {error && <p className="memory-publication-error" role="alert">{error}</p>}
    <p className="memory-publication-status" role="status">{busy || notice}</p>
    {!enabled && <p>Memory publication is waiting for this household’s private sharing service.</p>}
    {editable && <div className="memory-publication-tools"><label className="memory-photo-pick">Add a photo<input aria-label="Add a photo to this memory" type="file" accept="image/jpeg,image/png,image/webp" disabled={blocked} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run('Preparing your photo…', () => upload(file)); }}/></label>
      <button type="button" ref={lettersButton} disabled={blocked} onClick={() => void run('Opening your private letters…', async () => {
        const snapshot = await client.snapshot() as { mail: VaultMailCard[] }; vaultAssert(Array.isArray(snapshot.mail), 'VAULT_UNAVAILABLE');
        if (live.current) { setLetters(snapshot.mail.filter(m => m.state === 'active' && !m.sealed && (m.kind === 'letter' || m.kind === 'capsule'))); setSources([]); }
      })}>Choose from my letters</button></div>}
    {editable && recoveries.filter(r => r.kind === 'copy' && r.source && !candidate.media.some(m => m.contentId === r.id)).map(r => <div className="memory-copy-recovery" key={r.key}>
      <p>A separate attachment copy is waiting to return to your draft.</p><button type="button" disabled={blocked} onClick={() => void run('Recovering the same copy…', () => addCopy(r.source!))}>Retry adding this copy</button></div>)}
    {letters && editable && <section className="memory-source-drawer" aria-label="My private letter attachments"><h4>Choose one attachment to copy</h4><p>Your letter’s words and recipients stay private.</p>
      {letters.length === 0 && <p>No open letters with attachments are available yet.</p>}
      <div className="memory-publication-tools">{letters.map(letter => <button type="button" disabled={blocked} key={letter.id} onClick={() => void run('Opening the letter’s attachments…', async () => {
        const value = await client.command({ operation: 'read-publication', id: letter.id }) as { media: Pick<VaultMedia, 'id' | 'contentType' | 'byteLength' | 'sha256'>[] };
        if (live.current) setSources(value.media.map(m => ({ mediaId: m.id, publicationId: letter.id, contentType: m.contentType, byteLength: m.byteLength, sha256: m.sha256, alt: m.contentType.startsWith('image/') ? 'A photo we chose to keep' : 'A voice we chose to keep' })));
      })}>{letter.title || 'An open letter'}</button>)}</div>
      {sources.map(source => <div className="memory-source" key={`${source.publicationId}/${source.mediaId}`}><MemoryAttachment client={client} id={source.mediaId} publicationId={source.publicationId!} kind={source.contentType.startsWith('image/') ? 'image' : 'audio'} alt={source.alt}/>
        <button type="button" disabled={blocked} onClick={e => { copyReturn.current = e.currentTarget; setSelected(source); }}>Review a separate copy</button></div>)}
      <button type="button" onClick={() => { setLetters(null); setSources([]); setSelected(null); lettersButton.current?.focus(); }}>Close my letters</button></section>}
    {selected && editable && <section className="memory-copy-review" aria-label="Review the new attachment copy"><h4 ref={copyHeading} tabIndex={-1}>Only this attachment becomes a new copy</h4>
      <MemoryAttachment client={client} id={selected.mediaId} publicationId={selected.publicationId ?? undefined} initiallyOpen kind={selected.contentType.startsWith('image/') ? 'image' : 'audio'} alt={selected.alt}/>
      <p>The new copy goes into your memory draft. The resulting memory still needs each person’s exact review and choice to keep it.</p>
      <label>A caption for our memory<input maxLength={1000} value={selected.alt} disabled={blocked} onChange={e => setSelected({ ...selected, alt: e.target.value })}/></label>
      <div className="memory-publication-tools"><button type="button" disabled={blocked || !selected.alt.trim()} onClick={() => void run('Keeping a separate copy…', () => addCopy(selected))}>Add this separate copy to my draft</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => { setSelected(null); copyReturn.current?.focus(); }}>Cancel</button></div></section>}
    <div className="memory-attachment-grid">{candidate.media.map((media, index) => <figure key={`${candidate.revision}/${binding?.publicationId ?? 'draft'}/${media.contentId}/${index}`}>
      <MemoryAttachment client={client} id={media.contentId} publicationId={binding?.publicationId} mode={review?.state === 'active' ? 'active' : 'review'} privateFirst={editable} kind={media.kind} alt={media.alt}/>
      {editable ? <figcaption><label>Caption {index + 1}<input maxLength={1000} value={media.alt} disabled={blocked} onChange={e => onChange({ ...candidate, media: candidate.media.map((m, at) => at === index ? { ...m, alt: e.target.value } : m) })}/></label>
        <div className="memory-publication-tools"><button type="button" disabled={blocked || index === 0} aria-label={`Move attachment ${index + 1} earlier`} onClick={() => { const media = [...candidate.media]; [media[index - 1], media[index]] = [media[index]!, media[index - 1]!]; onChange({ ...candidate, media }); }}>Move earlier</button>
          <button type="button" disabled={blocked} onClick={() => onChange({ ...candidate, media: candidate.media.filter((_, at) => at !== index) })}>Remove from this draft</button></div></figcaption> : <figcaption>{media.alt}</figcaption>}
    </figure>)}</div>
    {editable && candidate.media.length > 0 && (!exact || !review || !proposalAccepted) && <button className="memory-publication-primary" type="button" disabled={blocked} onClick={() => void run('Preparing this exact composition…', prepare)}>{review && exact ? 'Retry sharing this exact review' : 'Share this composition for us to review'}</button>}
    {review && exact && proposalAccepted && <section className="memory-exact-review" aria-label="Exact shared memory review"><h4 ref={reviewHeading} tabIndex={-1}>We each choose this whole composition</h4>
      <h5>{review.memory.composition.title}</h5><p>{review.memory.composition.date ?? 'An ordinary moment, in our own time'}</p>
      {artwork}
      <WinMemorySource source={review.memory.composition.legacySource}/>
      <div className="memory-paired-words">{review.memory.composition.recollections.map(r => <article key={r.memberId}><h6>{name(r.memberId)} remembers</h6><p>{r.text || 'Room for their own words.'}</p></article>)}</div>
      <p>{review.memory.composition.hideAmounts ? 'Amounts stay out of this memory.' : 'This composition allows its reviewed amounts to appear.'}</p>
      <p>For {review.recipientMemberIds.map(name).join(' and ')}. A changed photo, caption, recollection, or amount choice needs a fresh review.</p>
      <div className="memory-publication-tools"><button type="button" disabled={blocked || mineKept || candidate.withdrawn} onClick={() => void run('Keeping the version you reviewed…', async () => {
        await approveMemoryReview(client, review, keep); if (live.current) { setNotice('Your choice to keep this exact version is saved.'); await refresh(); }
      })}>{mineKept ? 'You chose to keep this version' : 'Keep this exact version'}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('Refreshing the shared review…', refresh)}>Refresh our choices</button></div>
      {review.ownerMemberId === scope.memberId && review.state !== 'active' && <button className="memory-publication-primary" type="button" disabled={blocked || !allKept} onClick={() => void run('Placing our kept memory…', async () => {
        await activateMemoryReview(client, review); if (live.current) { setNotice('This kept memory is ready in our Theatre.'); await refresh(); onActivated?.(); }
      })}>Place our kept memory</button>}
      {!allKept && <p>There is room for each person to choose in their own time.</p>}
      {review.state === 'active' && <p className="memory-kept-stamp">Kept by us, just as we reviewed it.</p>}
      <button type="button" disabled={Boolean(busy)} onClick={() => setWithdrawing(true)}>Withdraw this shared copy</button>
    </section>}
    {withdrawing && binding && <section className="memory-withdraw-review" aria-label="Withdraw shared memory"><h4>Withdraw this shared copy?</h4><p>Its shared media access closes first. Original private letters and independently kept copies remain separate.</p>
      <div className="memory-publication-tools"><button type="button" disabled={Boolean(busy)} onClick={() => void run('Withdrawing access to this copy…', async () => {
        await withdrawMemoryReview(client, binding, withdraw); if (live.current) { setWithdrawing(false); setReview(null); setNotice('This shared copy has been withdrawn.'); }
      })}>Withdraw this shared copy now</button><button type="button" disabled={Boolean(busy)} onClick={() => setWithdrawing(false)}>Keep it here</button></div></section>}
  </section>;
}

function MemoryAttachment({ client, id, publicationId, mode = 'active', privateFirst = false, initiallyOpen = false, kind, alt }: {
  client: MemoryVaultClient; id: string; publicationId?: string; mode?: 'active' | 'review'; privateFirst?: boolean; initiallyOpen?: boolean; kind: 'image' | 'audio'; alt: string;
}) {
  const [opened, setOpened] = useState(initiallyOpen), [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (!opened) return; let alive = true, objectUrl = ''; setUrl(''); setError('');
    const read = async () => {
      let blob: Blob;
      if (privateFirst) {
        try { blob = await client.media(id); }
        catch (e) { if (!(e instanceof Error) || !/NOT_FOUND/.test(e.message) || !publicationId) throw e; blob = await client.media(id, publicationId, mode); }
      } else blob = await client.media(id, publicationId, publicationId ? mode : 'active');
      if (alive) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    };
    void read().catch(e => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, id, publicationId, mode, privateFirst, opened]);
  if (!opened) return <button className="memory-attachment-open" type="button" onClick={() => setOpened(true)}>{kind === 'image' ? 'Open photo' : 'Open voice note'}<span>{alt}</span></button>;
  return <div className="memory-attachment-view">{error ? <p role="alert">{error}</p> : !url ? <p role="status">Opening the attachment…</p> : kind === 'image' ? <img src={url} alt={alt} onError={() => setError('This photo could not be opened. Close it and retry, or choose another attachment.')}/> : <audio src={url} controls preload="metadata" aria-label={alt} onError={() => setError('This voice note could not be played. Close it and retry, or choose another attachment.')}/>}
    <button type="button" onClick={() => setOpened(false)}>Close attachment</button></div>;
}
