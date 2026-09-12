import { prepareBoardPhoto } from '../boardMedia/image.ts';
import { VAULT_MEDIA_LIMIT, vaultAssert, type VaultMedia } from './vaultContracts.ts';
export type LetterAttachment = { id: string; blob?: Blob; contentType: VaultMedia['contentType']; sha256?: string; byteLength?: number };
export async function letterAttachment(blob: Blob): Promise<LetterAttachment & { blob: Blob; sha256: string; byteLength: number }> {
  vaultAssert(blob.size > 0 && blob.size <= VAULT_MEDIA_LIMIT, 'MEDIA_TOO_LARGE');
  vaultAssert(['image/jpeg', 'audio/webm', 'audio/mp4', 'audio/ogg'].includes(blob.type), 'INVALID_MEDIA_TYPE');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
  return { id: `letter-media-${crypto.randomUUID()}`, blob, sha256, byteLength: blob.size, contentType: blob.type as VaultMedia['contentType'] };
}
/** Fresh decoded pixels, bounded JPEG encoding, then EXIF/IPTC/XMP/ICC marker removal. */
export async function normalizeLetterPhoto(source: Blob): Promise<LetterAttachment & { blob: Blob; sha256: string; byteLength: number }> {
  return letterAttachment((await prepareBoardPhoto(source)).blob);
}
export type LetterRecording = { stop(): Promise<Blob>; cancel(): void; finished?: Promise<Blob> };
export async function recordLetterVoice(): Promise<LetterRecording> {
  vaultAssert(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined', 'MICROPHONE_UNAVAILABLE');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { stream.getTracks().forEach(track => track.stop()); throw new Error('RECORDING_UNSUPPORTED'); }
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 }); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  let cancelled = false, size = 0, failure: Error | null = null;
  const chunks: Blob[] = [];
  let resolve!: (blob: Blob) => void, reject!: (error: Error) => void;
  const done = new Promise<Blob>((yes, no) => { resolve = yes; reject = no; });
  // Cancellation/recorder failure may precede the UI's stop call.
  void done.catch(() => {});
  const closeTracks = () => stream.getTracks().forEach(track => track.stop());
  recorder.ondataavailable = event => {
    size += event.data.size;
    if (size > VAULT_MEDIA_LIMIT) { failure = new Error('MEDIA_TOO_LARGE'); if (recorder.state !== 'inactive') recorder.stop(); }
    else if (event.data.size) chunks.push(event.data);
  };
  recorder.onerror = () => { failure = new Error('RECORDING_FAILED'); closeTracks(); reject(failure); };
  recorder.onstop = () => {
    closeTracks();
    if (cancelled || failure) reject(failure ?? new Error('RECORDING_CANCELLED'));
    else if (!size) reject(new Error('EMPTY_RECORDING'));
    else resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
  };
  try { recorder.start(500); } catch (error) { closeTracks(); throw error; }
  return {
    finished: done,
    stop: () => { if (recorder.state !== 'inactive') recorder.stop(); return done; },
    cancel: () => { cancelled = true; if (recorder.state !== 'inactive') recorder.stop(); closeTracks(); },
  };
}
