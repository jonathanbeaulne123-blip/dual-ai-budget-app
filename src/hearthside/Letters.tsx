import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HearthsideVaultClient, VaultClientScope } from './vaultClient.ts';
import { vaultAssert, type VaultDraft, type VaultMailCard, type VaultAuthorReview, type VaultPublicationReceipt } from './vaultContracts.ts';
import { IndexedDbLettersDraftStorage, lettersScopeKey, newLettersDraft, type LettersDraft, type LettersDraftStorage, type LettersReview } from './LettersState.tsx';
import { letterAttachment, normalizeLetterPhoto, recordLetterVoice, type LetterAttachment, type LetterRecording } from './lettersMedia.ts';
import './letters.css';

export type LettersClient = Pick<HearthsideVaultClient, 'snapshot' | 'command' | 'media' | 'queueMedia' | 'resumeUploads' | 'removeQueuedMedia'>;
export type LettersProps = {
  client: LettersClient; scope: VaultClientScope; theme: 'classic' | 'taylor' | 'newfoundland';
  roster: { memberId: string; name: string; active?: boolean }[];
  /** Root supplies the trusted publication adapter; exact review identity is immutable. */
  publishReviewed: (review: LettersReview) => Promise<VaultPublicationReceipt>;
  storage?: LettersDraftStorage; onClose: () => void; publicationEnabled?: boolean;
  normalizePhoto?: typeof normalizeLetterPhoto; recordVoice?: typeof recordLetterVoice;
};
/** Useful default for an activated, authenticated Vault with its trusted authority bound. */
export async function publishLettersReview(client: LettersClient, review: LettersReview): Promise<VaultPublicationReceipt> {
  await client.command({ operation: 'approve', id: review.id, digest: review.digest });
  const receipt = await client.command({ operation: 'activate', id: review.id }) as VaultPublicationReceipt;
  vaultAssert(receipt.publicationId === review.id && receipt.digest === review.digest && receipt.state === 'active', 'INVALID_PUBLICATION_RECEIPT');
  return receipt;
}
type Snapshot = { version: number; drafts: VaultDraft[]; mail: VaultMailCard[]; serverTime: number; publications: VaultPublicationReceipt[] };
type ReadLetter = Pick<LettersReview, 'id' | 'kind' | 'digest' | 'content' | 'releaseAt'> & { media: Pick<LetterAttachment, 'id' | 'contentType'>[] };
function message(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) return 'Microphone access was not allowed. Your words are still here; you can try recording again.';
  if (/MICROPHONE|RECORDING|EMPTY_RECORDING/.test(code)) return 'Recording is unavailable right now. Try again, or leave your words as a letter.';
  if (/PRIVATE_STORAGE|PRIVATE_UPLOAD_QUEUE|Quota/.test(code)) return 'This device could not keep the draft. Free some device space and retry saving before you leave.';
  if (/SEALED/.test(code)) return 'This capsule is still sealed. Hearth will open it at the chosen time.';
  if (/NOT_FOUND|REVOKED|REMOVED/.test(code)) return 'This item is no longer available. Refresh your letters to see the current collection.';
  if (/DRAFT_CHANGED|COMPOSITION_CHANGED|AUDIENCE_CHANGED/.test(code)) return 'Something changed on another device. Your local words are kept. Refresh and review the current version before sharing.';
  if (/UNAUTHENTICATED|FORBIDDEN|SCOPE_CHANGED/.test(code)) return 'Sign in to the selected household again. This private draft stays with its original account.';
  if (/VAULT_NOT_ACTIVATED|PUBLICATION_DISABLED|ENVIRONMENT_DISABLED/.test(code)) return 'Private sharing is not available here yet. You can keep working on your device draft.';
  if (/SOURCE_TOO_LARGE|UNSUPPORTED_IMAGE|INVALID_IMAGE|IMAGE_|DISPLAY_TOO_LARGE/.test(code)) return 'Choose a JPEG, PNG or WebP photo under 10 MB. The photo is prepared privately before sharing.';
  if (/MEDIA_TOO_LARGE/.test(code)) return 'This attachment is too large. Choose a smaller photo or a shorter voice note.';
  if (/RECIPIENT_REQUIRED/.test(code)) return 'Choose the person this letter is for.';
  if (/RELEASE_REQUIRED/.test(code)) return 'Choose a future date and time for this capsule.';
  if (/EMPTY_LETTER/.test(code)) return 'Add some words, a photo or a voice note first.';
  return 'That did not finish. Your draft and the same review are kept; try again when your connection is ready.';
}
function fallbackStorage(): LettersDraftStorage {
  const fail = async (): Promise<never> => { throw new Error('PRIVATE_STORAGE_UNAVAILABLE'); };
  return { list: fail, put: fail, remove: fail };
}
export function Letters(props: LettersProps) { return <LettersSurface key={lettersScopeKey(props.scope)} {...props}/>; }
function LettersSurface({ client, scope, theme, roster, storage, onClose, publishReviewed, publicationEnabled = true,
  normalizePhoto = normalizeLetterPhoto, recordVoice = recordLetterVoice }: LettersProps) {
  const id = useId(), heading = useRef<HTMLHeadingElement>(null), focusReturn = useRef<HTMLElement | null>(null);
  const composer = useRef<HTMLInputElement>(null), readerHeading = useRef<HTMLHeadingElement>(null), reviewHeading = useRef<HTMLHeadingElement>(null), focusComposer = useRef(false);
  const alive = useRef(true), writes = useRef<Promise<void>>(Promise.resolve()), readGeneration = useRef(0);
  const cache = useMemo(() => { try { return storage ?? new IndexedDbLettersDraftStorage(); } catch { return fallbackStorage(); } }, [storage]);
  const currentCache = useRef(cache); currentCache.current = cache;
  const [draft, setDraft] = useState<LettersDraft>(newLettersDraft), current = useRef(draft);
  const [localDrafts, setLocalDrafts] = useState<LettersDraft[]>([]), [cloudDrafts, setCloudDrafts] = useState<VaultDraft[]>([]);
  const [mail, setMail] = useState<VaultMailCard[]>([]), [selected, setSelected] = useState<VaultMailCard | null>(null), [reading, setReading] = useState<ReadLetter | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(''), [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<LetterRecording | null>(null), recordingRef = useRef<LetterRecording | null>(null), [seconds, setSeconds] = useState(0);
  const [removeReview, setRemoveReview] = useState(false), [withdrawReview, setWithdrawReview] = useState(false);
  const [clock, setClock] = useState({ server: Date.now(), at: Date.now() }), [tick, setTick] = useState(Date.now());
  const name = (memberId: string) => roster.find(m => m.memberId === memberId)?.name ?? 'Household member';
  const isLocked = Boolean(draft.publication), blocked = Boolean(busy) || Boolean(recording);
  const replace = (value: LettersDraft) => { current.current = value; if (alive.current) setDraft(value); };
  const persist = async (value: LettersDraft) => {
    replace(value);
    const write = writes.current.catch(() => {}).then(() => cache.put(scope, value));
    writes.current = write; await write;
    if (alive.current) setLocalDrafts(items => [...items.filter(item => item.id !== value.id), value]);
  };
  const edit = (patch: Partial<LettersDraft>) => {
    if (isLocked || blocked) return;
    const value = { ...current.current, ...patch, savedAt: Date.now() };
    setNotice('Keeping your private draft on this device…');
    void persist(value).then(() => { if (alive.current) setNotice('Private draft kept on this device'); })
      .catch(e => { if (alive.current) setError(message(e)); });
  };
  const refresh = async () => {
    const snap = await client.snapshot() as Snapshot;
    vaultAssert(snap.version === 1 && Array.isArray(snap.drafts) && Array.isArray(snap.mail), 'VAULT_UNAVAILABLE');
    if (!alive.current) return;
    setCloudDrafts(snap.drafts); setMail(snap.mail.filter(item => item.kind === 'letter' || item.kind === 'capsule'));
    setClock({ server: snap.serverTime, at: Date.now() });
  };
  useEffect(() => {
    alive.current = true;
    void cache.list(scope).then(items => { if (alive.current) setLocalDrafts(items); }).catch(e => { if (alive.current) setError(message(e)); });
    void refresh().catch(e => { if (alive.current) setError(message(e)); }).finally(() => { if (alive.current) setLoading(false); });
    return () => {
      alive.current = false; recordingRef.current?.cancel();
      // StrictMode immediately reacquires the same cache after its probe cleanup.
      if (!storage) void writes.current.catch(() => {}).then(() => {
        if (!alive.current || currentCache.current !== cache) return cache.close?.();
      });
    };
    // The keyed surface represents the exact scope; theme changes preserve its draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, cache]);
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (e) { if (alive.current) setError(message(e)); }
    finally { if (alive.current) setBusy(''); }
  };
  const attach = async (attachment: LetterAttachment & { blob: Blob; sha256: string; byteLength: number }) => {
    if (!alive.current) return;
    vaultAssert(current.current.content.mediaIds.length < 12, 'MEDIA_TOO_LARGE');
    const { blob, id: mediaId, ...manifest } = attachment;
    await client.queueMedia({ id: mediaId, ...manifest }, blob);
    if (!alive.current) return;
    await persist({ ...current.current, content: { ...current.current.content, mediaIds: [...current.current.content.mediaIds, mediaId] },
      attachments: [...current.current.attachments, attachment], savedAt: Date.now() });
    setNotice('Attachment kept privately. Save or review to upload it.');
  };
  const saveCloud = async (): Promise<LettersDraft> => {
    await persist(current.current);
    await client.resumeUploads(current.current.content.mediaIds);
    const captured = current.current;
    const saved = await client.command({ operation: 'save-draft', input: { id: captured.id, expectedRevision: captured.revision, content: captured.content } }) as VaultDraft;
    vaultAssert(saved.id === captured.id && saved.revision >= captured.revision, 'DRAFT_CHANGED');
    const updated = { ...captured, revision: saved.revision }; await persist(updated); return updated;
  };
  const prepare = () => run('Preparing your review…', async () => {
    const captured = current.current;
    vaultAssert(captured.recipientMemberIds.length > 0 && captured.recipientMemberIds.every(memberId => roster.some(m => m.memberId === memberId && m.active !== false)), 'RECIPIENT_REQUIRED');
    vaultAssert(captured.content.text.trim() || captured.content.mediaIds.length, 'EMPTY_LETTER');
    const releaseAt = captured.kind === 'capsule' ? new Date(captured.releaseLocal).getTime() : null;
    vaultAssert(captured.publication || releaseAt === null || (Number.isFinite(releaseAt) && releaseAt > Date.now()), 'RELEASE_REQUIRED');
    let value = captured.publication ? captured : await saveCloud();
    if (!value.publication) {
      value = { ...value, publication: { phase: 'preparing', review: null, input: { id: `letter-publication-${crypto.randomUUID()}`, draftId: value.id,
        draftRevision: value.revision, kind: value.kind, recipientMemberIds: value.recipientMemberIds, releaseAt } } };
      await persist(value);
    }
    const prepared = await client.command({ operation: 'prepare-publication', input: value.publication!.input }) as VaultAuthorReview;
    vaultAssert(prepared.id === value.publication!.input.id && typeof prepared.digest === 'string', 'INVALID_PUBLICATION_RECEIPT');
    if (!alive.current) return;
    const review: LettersReview = { id: prepared.id, digest: prepared.digest, kind: value.kind, content: prepared.content,
      recipientMemberIds: prepared.recipientMemberIds, releaseAt: prepared.releaseAt };
    await persist({ ...value, publication: { ...value.publication!, review, phase: prepared.state === 'active' ? 'active' : 'review' } });
  });
  const publish = () => run('Keeping this exact publication…', async () => {
    const value = current.current, review = value.publication?.review;
    vaultAssert(review, 'REVIEW_REQUIRED');
    await persist({ ...value, publication: { ...value.publication!, phase: 'publishing' } });
    const receipt = await publishReviewed(review);
    vaultAssert(receipt.publicationId === review.id && receipt.digest === review.digest && receipt.state === 'active', 'INVALID_PUBLICATION_RECEIPT');
    if (!alive.current) return;
    await persist({ ...current.current, publication: { ...current.current.publication!, phase: 'active' } });
    setNotice(review.kind === 'capsule' ? 'Your capsule is sealed until its chosen time.' : 'Your letter is available to its chosen recipient.');
    await refresh();
  });
  const stopRecording = () => run('Keeping your voice note…', async () => {
    const active = recordingRef.current; if (!active) return;
    recordingRef.current = null; setRecording(null);
    await attach(await letterAttachment(await active.stop()));
  });
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => { if (recording && seconds >= 120) void stopRecording(); }, [recording, seconds]);
  const open = (card: VaultMailCard) => {
    const generation = ++readGeneration.current;
    focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (card.role === 'sent' && (card.state === 'prepared' || card.state === 'accepted')) {
      void run('Recovering your exact review…', async () => {
        const p = await client.command({ operation: 'resume-publication', id: card.id }) as VaultAuthorReview;
        if (!alive.current || generation !== readGeneration.current) return;
        vaultAssert((p.kind === 'letter' || p.kind === 'capsule') && p.ownerMemberId === scope.memberId, 'FORBIDDEN');
        const recipients = p.recipientMemberIds;
        const review: LettersReview = { id: p.id, digest: p.digest, content: p.content, kind: p.kind, recipientMemberIds: recipients, releaseAt: p.releaseAt };
        // Keep a recovered review separate from a newer private source on this device.
        const value: LettersDraft = { ...newLettersDraft(), id: `letter-review-${p.digest.slice(0,40)}`, revision: 0, content: p.content,
          attachments: p.media.map(media => ({ id: media.id, contentType: media.contentType })), kind: p.kind, recipientMemberIds: recipients,
          releaseLocal: p.releaseAt ? new Date(p.releaseAt - new Date(p.releaseAt).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '',
          publication: { input: { id: p.id, draftId: p.draftId, draftRevision: p.draftRevision, kind: p.kind, recipientMemberIds: recipients, releaseAt: p.releaseAt },
            review, phase: p.state === 'accepted' ? 'publishing' : 'review' } };
        setSelected(null); setReading(null); await persist(value);
      });
      return;
    }
    setSelected(card); setReading(null); setWithdrawReview(false);
    void run('Opening your letter…', async () => { const value = await client.command({ operation: 'read-publication', id: card.id }) as ReadLetter;
      if (alive.current && generation === readGeneration.current) setReading(value); });
  };
  const closeReading = () => { readGeneration.current++; setSelected(null); setReading(null); setError(''); focusReturn.current?.focus(); };
  const startDraft = (value = newLettersDraft()) => { readGeneration.current++; focusComposer.current = true; setSelected(null); setReading(null); replace(value); setError(''); setNotice(''); setRemoveReview(false); };
  useEffect(() => { if (selected) readerHeading.current?.focus(); else if (focusComposer.current) { focusComposer.current = false; composer.current?.focus(); } }, [selected?.id, draft.id]);
  useEffect(() => { if (draft.publication?.review) reviewHeading.current?.focus(); }, [draft.publication?.review?.id]);
  const resumed = (value: VaultDraft): LettersDraft => ({ ...newLettersDraft(), id: value.id, revision: value.revision, content: value.content, savedAt: value.updatedAt });
  const drafts = [...localDrafts, ...cloudDrafts.filter(item => !localDrafts.some(local => local.id === item.id)).map(resumed)];
  const now = clock.server + tick - clock.at;
  const review = draft.publication?.review;
  const titles = { classic: ['The writing desk', 'A little warmth, folded for later.'], taylor: ['The letter folio', 'A page only the two of you can open.'], newfoundland: ['Letters by the window', 'Something to carry across the day.'] };
  return <section className="letters-room" data-letter-theme={theme} aria-labelledby={`${id}-title`}>
    <header className="letters-arrival"><LettersArt theme={theme}/><div><p className="letters-kicker">Private letters & little keepsakes</p><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{titles[theme][0]}</h2><p>{titles[theme][1]}</p></div><button className="letters-return" disabled={Boolean(recording)} onClick={onClose}>Return to the room</button></header>
    <p className="letters-boundary">Shared notes live on the room’s note rail. Letters stay private until you choose a recipient and publish the exact copy.</p>
    <div className="letters-layout"><aside className="letters-cabinet" aria-label="Your private correspondence">
      <div className="letters-actions"><button disabled={blocked} onClick={() => startDraft()}>Write a letter</button><button disabled={blocked} onClick={() => void run('Refreshing letters…', refresh)}>Refresh letters</button></div>
      <h3>Private drafts</h3>{!drafts.length && <p className="letters-empty">An unfinished thought can stay here.</p>}
      <ul>{drafts.map(item => <li key={item.id}><button disabled={blocked} aria-current={!selected && draft.id === item.id ? 'true' : undefined} onClick={() => startDraft(item)}><span>{item.content.title || 'An untitled letter'}</span><small>{item.publication?.phase === 'publishing' ? 'Publication needs recovery' : item.publication?.phase === 'active' ? 'Published copy kept separately' : item.revision ? 'Private cloud draft' : 'On this device'}</small></button></li>)}</ul>
      <h3>Letters between us</h3>{loading ? <p>Opening your collection…</p> : !mail.length ? <p className="letters-empty">There is no hurry to fill this shelf.</p> : <ul>{mail.map(card => <li key={card.id}><button disabled={blocked} onClick={() => open(card)}><span>{card.sealed ? 'A sealed time capsule' : card.title || (card.kind === 'capsule' ? 'A time capsule' : 'A letter')}</span><small>{card.role === 'sent' ? `To ${card.recipientMemberIds.map(name).join(', ')}` : `From ${name(card.ownerMemberId)}`} · {card.state === 'revoked' ? 'Withdrawn' : card.sealed ? 'For later' : card.state === 'prepared' ? 'Not yet published' : 'Kept here'}</small></button></li>)}</ul>}
    </aside><div className="letters-working">
      {error && <div role="alert" className="letters-error">{error}</div>}
      {(busy || notice) && <p role="status" className="letters-status">{busy || notice}</p>}
      {selected ? <article className="letters-paper letters-reading"><button disabled={blocked} onClick={closeReading}>Back to writing</button><p className="letters-kicker">{selected.role === 'sent' ? 'A copy you chose to share' : `From ${name(selected.ownerMemberId)}`}</p>
        <h3 ref={readerHeading} tabIndex={-1}>{reading?.content.title || (selected.sealed ? 'For a day still to come' : selected.title || 'A letter')}</h3>
        {selected.sealed && !reading && <div className="letters-seal-message"><span aria-hidden="true">✦</span><p>This capsule opens {selected.releaseAt ? new Date(selected.releaseAt).toLocaleString() : 'at its chosen time'}.</p><p>{selected.releaseAt && selected.releaseAt > now ? `${Math.ceil((selected.releaseAt - now) / 86400000)} ${Math.ceil((selected.releaseAt - now) / 86400000) === 1 ? 'day' : 'days'} to its opening` : 'Its time may have arrived. Check with Hearth to open it.'}</p></div>}
        {reading && <><p className="letters-body">{reading.content.text}</p><div className="letters-media-grid">{reading.media.map(item => <LettersMedia key={item.id} attachment={item} client={client} publicationId={reading.id}/>)}</div></>}
        {!reading && <button disabled={blocked} onClick={() => open(selected)}>Try opening again</button>}
        {selected.role === 'sent' && selected.state !== 'revoked' && <div className="letters-withdraw"><button disabled={blocked} onClick={() => setWithdrawReview(true)}>Withdraw this publication</button>{withdrawReview && <div><p>This stops future access to this shared copy. Your private draft stays yours.</p><button disabled={blocked} onClick={() => void run('Withdrawing access…', async () => { await client.command({ operation: 'withdraw', id: selected.id }); if (!alive.current) return; setReading(null); setSelected({ ...selected, state: 'revoked' }); setWithdrawReview(false); setNotice('Access to this publication is withdrawn.'); await refresh(); })}>Withdraw access now</button><button disabled={blocked} onClick={() => setWithdrawReview(false)}>Keep publication</button></div>}</div>}
      </article> : <>
        <form className="letters-paper letters-compose" onSubmit={event => { event.preventDefault(); void prepare(); }}>
          <div className="letters-paper-top"><p className="letters-kicker">{isLocked ? 'The exact copy you reviewed' : 'Your words, in your own time'}</p><span aria-hidden="true" className="letters-stamp">{theme === 'newfoundland' ? '↟' : theme === 'taylor' ? '✧' : '❧'}</span></div>
          <fieldset disabled={blocked || isLocked}><legend className="letters-sr-only">Compose your private letter</legend>
            <label>Letter title<input ref={composer} value={draft.content.title} maxLength={180} onChange={event => edit({ content: { ...draft.content, title: event.target.value } })} placeholder="A little something for you"/></label>
            <label>Your words<textarea aria-label="Your words" value={draft.content.text} maxLength={24000} rows={10} onChange={event => edit({ content: { ...draft.content, text: event.target.value } })} placeholder="A thought, a thank-you, an ordinary moment…"/></label>
            <fieldset className="letters-recipient"><legend>For</legend>{roster.filter(member => member.active !== false && member.memberId !== scope.memberId).map(member => <label key={member.memberId}><input type="checkbox" checked={draft.recipientMemberIds.includes(member.memberId)} onChange={event => edit({ recipientMemberIds: event.target.checked ? [...draft.recipientMemberIds, member.memberId] : draft.recipientMemberIds.filter(id => id !== member.memberId) })}/>{member.name}</label>)}</fieldset>
            <label>When to open<select value={draft.kind} onChange={event => edit({ kind: event.target.value as LettersDraft['kind'] })}><option value="letter">When I publish this letter</option><option value="capsule">On a future date — time capsule</option></select></label>
            {draft.kind === 'capsule' && <label>Open on this date and time<input type="datetime-local" value={draft.releaseLocal} onChange={event => edit({ releaseLocal: event.target.value })}/><small>Shown in your device’s time zone. The review shows the exact opening time.</small></label>}
            <div className="letters-attach"><label className="letters-file">Add a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run('Preparing your photo privately…', async () => attach(await normalizePhoto(file))); }}/></label>
              <button type="button" onClick={() => void run('Asking for microphone access…', async () => {
                const rec = await recordVoice(); if (!alive.current) { rec.cancel(); return; }
                recordingRef.current = rec; setRecording(rec); setSeconds(0);
                void rec.finished?.then(blob => {
                  if (!alive.current || recordingRef.current !== rec) return;
                  recordingRef.current = null; setRecording(null);
                  void run('The recording stopped. Keeping your voice note…', async () => attach(await letterAttachment(blob)));
                }, error => {
                  if (!alive.current || recordingRef.current !== rec) return;
                  recordingRef.current = null; setRecording(null); setError(message(error));
                });
              })}>Record a voice note</button></div>
          </fieldset>
          {recording && <div className="letters-recording"><p role="timer" aria-live="off">Recording · {seconds}s / 120s</p><button type="button" onClick={() => void stopRecording()}>Stop and keep voice note</button><button type="button" onClick={() => { recordingRef.current?.cancel(); recordingRef.current = null; setRecording(null); setNotice('Recording discarded. Your letter is unchanged.'); }}>Discard recording</button></div>}
          <div className="letters-media-grid">{draft.content.mediaIds.map(mediaId => { const attachment = draft.attachments.find(item => item.id === mediaId) ?? { id: mediaId, contentType: 'image/jpeg' as const }; return <div key={mediaId}><LettersMedia client={client} attachment={attachment}/>{!isLocked && <button type="button" disabled={blocked} onClick={() => void run('Removing this attachment…', async () => { await persist({ ...current.current, content: { ...current.current.content, mediaIds: current.current.content.mediaIds.filter(id => id !== mediaId) }, attachments: current.current.attachments.filter(item => item.id !== mediaId) }); await client.removeQueuedMedia([mediaId]); })}>Remove attachment</button>}</div>; })}</div>
          {!isLocked && <div className="letters-actions"><button type="button" disabled={blocked} onClick={() => void run('Saving your private cloud draft…', async () => { await saveCloud(); if (alive.current) { setNotice('Private cloud draft saved. It is still only yours.'); await refresh(); } })}>Save private draft</button><button type="submit" disabled={blocked || !publicationEnabled}>Review sharing</button></div>}
          {isLocked && !review && <button type="button" disabled={blocked} onClick={() => void prepare()}>Recover the same review</button>}
        </form>
        {review && <section className="letters-paper letters-review" aria-labelledby={`${id}-review`}><p className="letters-kicker">One deliberate shared copy</p><h3 id={`${id}-review`} ref={reviewHeading} tabIndex={-1}>{draft.publication?.phase === 'active' ? 'This copy has been published' : 'Review before sharing'}</h3>
          <dl><div><dt>For</dt><dd>{review.recipientMemberIds.map(name).join(', ')}</dd></div><div><dt>Available</dt><dd>{review.releaseAt ? new Date(review.releaseAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) : 'After you publish this copy'}</dd></div></dl>
          <h4>{review.content.title || 'An untitled letter'}</h4><p className="letters-body">{review.content.text}</p><p>{review.content.mediaIds.length} {review.content.mediaIds.length === 1 ? 'attachment' : 'attachments'} in this exact copy. No email or read receipt is sent.</p>
          {draft.publication?.phase !== 'active' && <div className="letters-actions"><button disabled={blocked || !publicationEnabled} onClick={() => void publish()}>{draft.publication?.phase === 'publishing' ? 'Retry this publication' : review.kind === 'capsule' ? 'Seal this exact capsule' : 'Publish this exact letter'}</button><button disabled={blocked} onClick={() => void run('Releasing this review…', async () => { await client.command({ operation: 'withdraw', id: review.id }); if (!alive.current) return; await persist({ ...current.current, publication: null }); setNotice('The previous review is withdrawn. You can edit your draft.'); })}>Withdraw review and edit</button></div>}
        </section>}
        <div className="letters-draft-remove"><button disabled={blocked} onClick={() => setRemoveReview(true)}>Delete private draft</button>{removeReview && <div className="letters-paper"><p>Delete these private words and attachments from your drafts? Published copies remain available until you withdraw them separately.</p><button disabled={blocked} onClick={() => void run('Deleting your private draft…', async () => { const value = current.current; await writes.current; if (value.revision) await client.command({ operation: 'delete-draft', input: { id: value.id, expectedRevision: value.revision } }); await client.removeQueuedMedia(value.content.mediaIds); await cache.remove(scope, value.id); if (!alive.current) return; setLocalDrafts(items => items.filter(item => item.id !== value.id)); startDraft(); await refresh(); setNotice('Private draft deleted.'); })}>Delete this draft</button><button disabled={blocked} onClick={() => setRemoveReview(false)}>Keep drafting</button></div>}</div>
      </>}
      <footer className="letters-closing"><span aria-hidden="true">{theme === 'newfoundland' ? '⌁' : '— ❧ —'}</span><p>Some things are lovely simply because you chose to say them.</p></footer>
    </div></div>
  </section>;
}
function LettersMedia({ attachment, client, publicationId }: { attachment: LetterAttachment; client: LettersClient; publicationId?: string }) {
  const [url, setUrl] = useState(''), [type, setType] = useState(attachment.contentType), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, objectUrl = ''; setError(false); setUrl('');
    void (attachment.blob ? Promise.resolve(attachment.blob) : client.media(attachment.id, publicationId)).then(blob => {
      if (!active) return; objectUrl = URL.createObjectURL(blob); setType(blob.type as LetterAttachment['contentType']); setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.id, attachment.blob, client, publicationId, attempt]);
  return <figure className="letters-media">{error ? <><p>This attachment is unavailable.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry attachment</button></> : !url ? <p>Opening attachment…</p> : type.startsWith('audio/') ? <audio controls preload="metadata" src={url} aria-label="Voice note" onError={() => setError(true)}/> : <img src={url} alt="Photo attached to this letter" onError={() => setError(true)}/>}</figure>;
}
function LettersArt({ theme }: { theme: LettersProps['theme'] }) {
  return <svg className="letters-art" viewBox="0 0 660 280" aria-hidden="true" focusable="false">
    {theme === 'newfoundland' ? <><path d="M420 20H620V255H420Z" fill="#cae0df" stroke="#476965" strokeWidth="14"/><path d="M520 20V255M420 136H620" stroke="#476965" strokeWidth="8"/><path d="M425 188Q490 160 560 178T620 167V250H425" fill="#638b96"/><path d="M465 179V115L492 91 518 115V184" fill="#c38060"/><path d="M448 218Q510 206 606 221M442 239Q528 217 612 239" stroke="#dbe8df" fill="none"/><path d="M40 230Q80 185 113 222T180 226T242 225" stroke="#97856a" strokeWidth="10" fill="none"/></> : theme === 'taylor' ? <><path d="M422 30L628 54 604 248 399 227Z" fill="#e5bdcc"/><path d="M437 51L606 71 588 220 421 202Z" fill="#fff0d5"/><path d="M30 55Q160 2 235 68T389 71" stroke="#b97491" strokeWidth="12" fill="none"/><path d="M139 44Q78 9 75 47T139 44Q190 6 198 50T139 44" fill="none" stroke="#9d627f" strokeWidth="7"/><path d="M470 90L528 83 554 125 492 136Z" fill="#d1bfdb"/></> : <><path d="M415 30H620V238H415Z" fill="#a1b0a0" stroke="#806a4e" strokeWidth="10"/><path d="M518 30V238M415 120H620" stroke="#806a4e" strokeWidth="7"/><path d="M50 210Q37 147 72 109M59 174Q18 151 20 128M63 143Q111 133 111 110" fill="none" stroke="#6e7959" strokeWidth="8"/><path d="M27 208H91L81 267H37Z" fill="#b28769"/></>}
    <path d="M175 106L395 87 432 246 205 265Z" fill={theme === 'taylor' ? '#fbf1db' : '#f4e6c8'} stroke="#bba789" strokeWidth="2"/><path d="M175 106L312 179 395 87M205 265L283 166M432 246L339 160" stroke="#bba789" fill="none" strokeWidth="2"/><circle cx="312" cy="181" r="23" fill={theme === 'newfoundland' ? '#836047' : theme === 'taylor' ? '#a96585' : '#aa624d'}/><path d="M302 177Q312 163 321 177L311 190Z" fill="#e9cbaa"/>
  </svg>;
}
