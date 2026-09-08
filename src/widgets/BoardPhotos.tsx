import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createBoardMediaClient, type BoardMediaClient, type BoardPhotoIntent, type PendingBoardPhoto, SOURCE_MAX_BYTES } from "../boardMedia/index.ts";
import { ensureSupabaseSession, loadSupabaseSession, SUPABASE_SESSION_CHANGED_EVENT } from "../auth/supabaseSession.ts";
import { setBoardPhoto, shapeSharedBoards, type CommitResult, type Household } from "../core/index.ts";
import type { BoardPhoto } from "../core/sharedBoards.ts";

type Props = { household: Household; memberId: string; busy: boolean; onCommand: (fn: (current: Household) => CommitResult) => void };
const defaultCrop = { x: 50, y: 50, zoom: 1 };
function authKey(household: Household) {
  const session = loadSupabaseSession(household.environment);
  return session ? JSON.stringify([session.userId, session.sessionId]) : "signed-out";
}
function message(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "BOARD_MEDIA_UNAVAILABLE") return "Photo sharing is not available yet. Your photo is kept here for retry.";
  return error instanceof Error ? error.message : "The photo could not be saved. Please try again.";
}
/** A fresh auth/household session gets a fresh client, even on A → B → A. */
export function BoardPhotos(props: Props) {
  const [auth, setAuth] = useState(() => ({ identity: authKey(props.household), generation: 0 }));
  useEffect(() => {
    const refresh = () => { const identity = authKey(props.household); setAuth(current => current.identity === identity ? current : { identity, generation: current.generation + 1 }); };
    refresh();
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [props.household.environment]);
  return <PhotoSession key={JSON.stringify([props.household.environment, props.household.householdId, props.memberId, auth.identity, auth.generation])} {...props} identity={auth.identity} />;
}
function PhotoSession({ household, memberId, busy, onCommand, identity }: Props & { identity: string }) {
  const [client, setClient] = useState<BoardMediaClient | null>(null);
  const [pending, setPending] = useState<PendingBoardPhoto[]>([]);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const retired = useRef(false);
  const latest = useRef(household); latest.current = household;
  const photos = shapeSharedBoards(household.kitchen.boards).photos;
  useLayoutEffect(() => {
    retired.current = false;
    const session = loadSupabaseSession(household.environment);
    if (!session || authKey(household) !== identity) return () => { retired.current = true; };
    const media = createBoardMediaClient({
      scope: { environment: household.environment, householdId: household.householdId, actorId: memberId, authIdentity: session.userId },
      isCurrent: () => !retired.current && authKey(household) === identity && latest.current.members.some(member => member.id === memberId && member.active),
      getSession: async () => {
        const fresh = await ensureSupabaseSession(household.environment);
        return fresh && authKey(household) === identity ? { accessToken: fresh.accessToken, actorId: memberId, authIdentity: fresh.userId } : null;
      },
    });
    // Retire synchronously at the auth event, before React can batch A → B → A into one render.
    const changed = () => { if (authKey(household) !== identity) { retired.current = true; media.dispose(); setClient(null); } };
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, changed); window.addEventListener("storage", changed);
    setClient(media);
    void media.listPendingBoardPhotos().then(rows => { if (!retired.current) setPending(rows); }).catch(error => { if (!retired.current) setNotice(message(error)); });
    return () => { retired.current = true; media.dispose(); window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, changed); window.removeEventListener("storage", changed); };
  }, [identity, household.environment, household.householdId, memberId]);
  const acknowledging = useRef(new Set<string>());
  useEffect(() => {
    if (!client) return;
    for (const row of pending) {
      if (!row.intent || row.status !== "uploaded" || acknowledging.current.has(row.pendingId)) continue;
      const accepted = photos.find(photo => photo.id === `BOARD-PHOTO-${row.intent!.slot}` && photo.mediaId === row.mediaId && photo.version > row.intent!.expectedVersion);
      if (!accepted) continue;
      acknowledging.current.add(row.pendingId);
      void client.acknowledgeBoardPhoto(row.pendingId).then(() => {
        if (!retired.current) { setPending(current => current.filter(item => item.pendingId !== row.pendingId)); setNotice("Photo saved."); }
      }).catch(error => { if (!retired.current) setNotice(message(error)); }).finally(() => acknowledging.current.delete(row.pendingId));
    }
  }, [client, photos, pending]);
  async function refreshPending() {
    if (!client || retired.current) return;
    try { const rows = await client.listPendingBoardPhotos(); if (!retired.current) setPending(rows); }
    catch (error) { if (!retired.current) setNotice(message(error)); }
  }
  function commit(intent: BoardPhotoIntent, mediaId: string | null) {
    if (retired.current || authKey(household) !== identity) return;
    const scope = { environment: household.environment, householdId: household.householdId };
    onCommand(current => {
      if (retired.current || authKey(household) !== identity || current.environment !== scope.environment || current.householdId !== scope.householdId) throw new Error("Reopen this household before saving a photo.");
      return setBoardPhoto(current, { ...intent, mediaId, memberId });
    });
  }
  async function upload(file: File, intent: BoardPhotoIntent) {
    if (!client || retired.current) return null;
    setWorking(true); setNotice("");
    try {
      const reference = await client.uploadBoardPhoto(file, intent);
      if (!retired.current) { commit(intent, reference.mediaId); setNotice("Photo uploaded. Waiting for the board to save it."); return reference.mediaId; }
    } catch (error) { if (!retired.current) setNotice(message(error)); }
    finally { if (!retired.current) { setWorking(false); await refreshPending(); } }
    return null;
  }
  async function retry(row: PendingBoardPhoto) {
    if (!client || !row.intent || retired.current) return;
    // The original rendered version stays frozen through retries and reloads.
    const current = photos.find(photo => photo.id === `BOARD-PHOTO-${row.intent!.slot}`);
    if ((current?.version ?? 0) !== row.intent.expectedVersion) { setNotice("That photo space changed while this upload was waiting. Keep the current photo, or discard this pending upload and choose it again."); return; }
    setWorking(true); setNotice("");
    try { const reference = await client.retryPendingBoardPhoto(row.pendingId); if (!retired.current) { commit(row.intent, reference.mediaId); setNotice("Photo uploaded. Waiting for the board to save it."); } }
    catch (error) { if (!retired.current) setNotice(message(error)); }
    finally { if (!retired.current) { setWorking(false); await refreshPending(); } }
  }
  async function discard(row: PendingBoardPhoto) {
    if (!client) return;
    setWorking(true);
    try { await client.discardPendingBoardPhoto(row.pendingId); if (!retired.current) setPending(current => current.filter(item => item.pendingId !== row.pendingId)); }
    catch (error) { if (!retired.current) setNotice(message(error)); }
    finally { if (!retired.current) setWorking(false); }
  }
  return <div className="shared-board-photos">
    {notice && <p className="shared-board-photo-notice" role="status">{notice}</p>}
    {!client && <p className="shared-board-photo-notice">Sign in to share photos.</p>}
    {([1, 2, 3] as const).map(slot => <PhotoSlot key={slot} slot={slot} photo={photos.find(photo => photo.id === `BOARD-PHOTO-${slot}`)} client={client} busy={busy || working}
      pending={pending.filter(row => row.intent?.slot === slot)} onUpload={upload} onCommit={commit} onRetry={retry} onDiscard={discard} />)}
    {pending.filter(row => !row.intent).map(row => <div key={row.pendingId} className="shared-board-photo-recovery"><p>A previous upload has no photo space attached. Discard it and choose the photo again.</p><button type="button" disabled={busy || working} onClick={() => void discard(row)}>Discard pending upload</button></div>)}
  </div>;
}

function usePhotoUrl(client: BoardMediaClient | null, mediaId: string | null) {
  const [value, setValue] = useState<{ url: string; error: string }>({ url: "", error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; let url = "";
    setValue({ url: "", error: "" });
    if (client && mediaId) void client.getBoardPhoto(mediaId).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob); setValue({ url, error: "" });
    }).catch(error => { if (active) setValue({ url: "", error: message(error) }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [client, mediaId, attempt]);
  return { ...value, retry: () => setAttempt(value => value + 1) };
}
function cropStyle(crop: BoardPhoto["crop"]): CSSProperties {
  return { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` };
}
function PhotoSlot({ slot, photo, client, busy, pending, onUpload, onCommit, onRetry, onDiscard }: {
  slot: 1 | 2 | 3; photo?: BoardPhoto; client: BoardMediaClient | null; busy: boolean; pending: PendingBoardPhoto[];
  onUpload: (file: File, intent: BoardPhotoIntent) => Promise<string | null>; onCommit: (intent: BoardPhotoIntent, mediaId: string | null) => void;
  onRetry: (row: PendingBoardPhoto) => Promise<void>; onDiscard: (row: PendingBoardPhoto) => Promise<void>;
}) {
  const [editor, setEditor] = useState<(BoardPhotoIntent & { mediaId: string | null; file: File | null }) | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<typeof editor>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const source = usePhotoUrl(client, photo?.mediaId ?? null);
  const stale = !!editor && (photo?.version ?? 0) !== editor.expectedVersion;
  useEffect(() => {
    if (!editor?.file) { setPreview(""); return; }
    const url = URL.createObjectURL(editor.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editor?.file]);
  useEffect(() => {
    if (submitted && photo && photo.version > submitted.expectedVersion && photo.caption === submitted.caption.trim()
      && JSON.stringify(photo.crop) === JSON.stringify(submitted.crop) && (submitted.file ? !!uploadedMediaId && photo.mediaId === uploadedMediaId : photo.mediaId === submitted.mediaId)) {
      setEditor(current => current === submitted ? null : current); setSubmitted(null);
    }
  }, [submitted, photo, uploadedMediaId]);
  useEffect(() => {
    if (enlarged && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [enlarged]);
  const openEditor = () => { setError(""); setSubmitted(null); setEditor({ slot, mediaId: photo?.mediaId ?? null, caption: photo?.caption ?? "", crop: { ...(photo?.crop ?? defaultCrop) }, expectedVersion: photo?.version ?? 0, file: null }); };
  return <figure className="shared-board-photo" aria-label={`Household photo ${slot}`}>
    {source.url ? <button type="button" className="shared-board-photo-open" aria-label={`Enlarge photo ${slot}${photo?.caption ? `: ${photo.caption}` : ""}`} onClick={() => setEnlarged(true)}><div className="shared-board-photo-viewport"><img src={source.url} alt={photo?.caption || `Household photo ${slot}`} style={cropStyle(photo?.crop ?? defaultCrop)} /></div></button>
      : <div className="shared-board-photo-placeholder"><span aria-hidden="true">{slot === 1 ? "♡" : slot === 2 ? "✧" : "⌂"}</span><p>{photo?.mediaId ? "Your photo belongs here." : ["A favourite face", "A day worth keeping", "Somewhere that feels like home"][slot - 1]}</p></div>}
    {photo?.caption && <figcaption>{photo.caption}</figcaption>}
    {source.error && <div className="shared-board-photo-notice" role="status"><p>{source.error}</p><button type="button" onClick={source.retry}>Retry opening photo {slot}</button></div>}
    <div className="shared-board-actions"><button type="button" disabled={busy || !client} onClick={() => { if (!editor) openEditor(); }}>{photo?.mediaId ? `Edit photo ${slot}` : `Add photo ${slot}`}</button>
      {photo?.mediaId && <button type="button" disabled={busy} onClick={() => onCommit({ slot, caption: "", crop: defaultCrop, expectedVersion: photo.version }, null)}>Remove photo {slot}</button>}</div>
    {editor && <form className="shared-board-photo-editor" data-board-no-swipe onSubmit={event => {
      event.preventDefault(); if (busy || stale || (!editor.file && !editor.mediaId)) return;
      setSubmitted(editor); setUploadedMediaId(null);
      const intent: BoardPhotoIntent = { slot, caption: editor.caption, crop: { ...editor.crop }, expectedVersion: editor.expectedVersion };
      if (editor.file) void onUpload(editor.file, intent).then(setUploadedMediaId); else onCommit(intent, editor.mediaId);
    }}>
      <label>{editor.mediaId ? "Replace this photo" : "Choose a photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > SOURCE_MAX_BYTES) { setError("Choose a JPEG, PNG or WebP photo up to 10 MB."); event.target.value = ""; return; }
        setError(""); setEditor({ ...editor, file, crop: { ...defaultCrop } });
      }} /></label>
      {(preview || source.url) && <div className="shared-board-photo-viewport"><img src={preview || source.url} alt={`Crop preview for photo ${slot}`} style={cropStyle(editor.crop)} /></div>}
      <label>Caption<input aria-label={`Photo ${slot} caption`} value={editor.caption} maxLength={240} onChange={event => setEditor({ ...editor, caption: event.target.value })} /></label>
      <fieldset><legend>Frame your photo</legend>{([['x', 'Horizontal position', 0, 100, 1], ['y', 'Vertical position', 0, 100, 1], ['zoom', 'Zoom', 1, 3, .05]] as const).map(([axis, label, min, max, step]) => <label key={axis}>{label}<input type="range" aria-label={`Photo ${slot} ${label.toLowerCase()}`} min={min} max={max} step={step} value={editor.crop[axis]} onChange={event => setEditor({ ...editor, crop: { ...editor.crop, [axis]: Number(event.target.value) } })} /></label>)}</fieldset>
      {error && <p role="alert">{error}</p>}
      {stale && <p role="status">This photo space changed elsewhere. Your draft is still here. Cancel and reopen it to use the latest photo.</p>}
      <div className="shared-board-actions"><button type="submit" disabled={busy || stale || !client || pending.length > 0 || (!editor.file && !editor.mediaId)}>Save photo {slot}</button><button type="button" disabled={busy} onClick={() => { setEditor(null); setSubmitted(null); }}>Cancel</button></div>
    </form>}
    {pending.map(row => <div key={row.pendingId} className="shared-board-photo-recovery" role="status"><p>{row.status === "uploaded" ? "Uploaded; waiting for this photo space to save." : "Your photo is waiting to upload."} {row.intent?.caption}</p>
      <div className="shared-board-actions"><button type="button" disabled={busy || !client} onClick={() => void onRetry(row)}>Retry photo {slot}</button><button type="button" disabled={busy || !client} onClick={() => void onDiscard(row)}>Discard pending photo {slot}</button></div></div>)}
    {enlarged && <dialog ref={dialog} className="shared-board-photo-dialog" aria-label={`Enlarged photo ${slot}`} data-dialog-escape-boundary data-board-no-swipe onClose={() => setEnlarged(false)} onCancel={event => { event.stopPropagation(); }}>
      <button type="button" autoFocus onClick={() => { dialog.current?.close(); setEnlarged(false); }}>Close photo</button><img src={source.url} alt={photo?.caption || `Household photo ${slot}`} />{photo?.caption && <p>{photo.caption}</p>}
    </dialog>}
  </figure>;
}
