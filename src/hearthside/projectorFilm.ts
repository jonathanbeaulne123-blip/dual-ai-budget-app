import { buildProjectorPages, paintProjectorPage, PROJECTOR_HEIGHT, PROJECTOR_WIDTH } from './projectorCanvas.ts';
import { awaitProjector, checkProjectorCurrent } from './projectorComposition.ts';
import type { PreparedProjector, ProjectorFile, ProjectorGuard } from './projectorTypes.ts';

export const PROJECTOR_MAX_ENCODED_BYTES = 64 * 1024 * 1024;
export function supportedProjectorMime(recorder: Pick<typeof MediaRecorder, 'isTypeSupported'> | undefined = globalThis.MediaRecorder): string | null {
  if (!recorder) return null;
  for (const mime of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm', 'video/mp4']) {
    try { if (recorder.isTypeSupported(mime)) return mime; } catch { /* Probe failure does not promise a working encoder. */ }
  }
  return null;
}
export function projectorWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms); signal.addEventListener('abort', abort, { once: true });
  });
}
export async function recordProjectorFilm(prepared: PreparedProjector, guard: ProjectorGuard, onProgress?: (progress: number) => void, dedicatedAudioContext?: AudioContext): Promise<ProjectorFile> {
  const canvas = document.createElement('canvas'); canvas.width = PROJECTOR_WIDTH; canvas.height = PROJECTOR_HEIGHT;
  const ctx = canvas.getContext('2d'), pageCanvas = document.createElement('canvas'), pageContext = pageCanvas.getContext('2d');
  const mime = supportedProjectorMime();
  if (!ctx || !pageContext || !mime || typeof canvas.captureStream !== 'function') { if (dedicatedAudioContext && dedicatedAudioContext.state !== 'closed') await dedicatedAudioContext.close(); throw Error('PROJECTOR_FILM_UNAVAILABLE'); }
  pageContext.font = '22px Georgia'; const pages = buildProjectorPages(prepared, text => pageContext.measureText(text).width);
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, audioContext = dedicatedAudioContext, currentAudio: AudioBufferSourceNode | undefined;
  let encodedBytes = 0; const chunks: Blob[] = [], buffers = new Map<string, AudioBuffer>(); let failure: Error | undefined, actualMime = mime;
  try {
    checkProjectorCurrent(guard); if (!pages.length) throw Error('PROJECTOR_EMPTY_SELECTION');
    const audioAssets = prepared.assets.filter(asset => asset.kind === 'audio' && asset.status === 'available' && asset.blob);
    if (audioAssets.length) {
      audioContext ??= new AudioContext(); await awaitProjector(audioContext.resume(), guard.signal, 8000); let decodedBytes = 0;
      for (const asset of audioAssets) { const sourceBytes = await awaitProjector(asset.blob!.arrayBuffer(), guard.signal); const buffer = await awaitProjector(audioContext.decodeAudioData(sourceBytes), guard.signal, 20000); checkProjectorCurrent(guard); decodedBytes += buffer.length * buffer.numberOfChannels * 4; if (decodedBytes > 128 * 1024 * 1024) throw Error('PROJECTOR_AUDIO_LIMIT'); buffers.set(asset.key, buffer); }
    }
    const durations = pages.map(page => Math.max(prepared.selection.options.secondsPerPage, page.asset ? buffers.get(page.asset.key)?.duration ?? 0 : 0));
    const total = durations.reduce((sum, seconds) => sum + seconds, 0); if (total > 30 * 60) throw Error('PROJECTOR_FILM_DURATION_LIMIT');
    await paintProjectorPage(pageCanvas, pages[0]!, prepared); checkProjectorCurrent(guard); ctx.drawImage(pageCanvas, 0, 0);
    stream = canvas.captureStream(24); const destination = audioContext?.createMediaStreamDestination();
    for (const track of destination?.stream.getAudioTracks() ?? []) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 });
    let resolveStopped: () => void = () => {}; const stopped = new Promise<void>(resolve => { resolveStopped = resolve; });
    recorder.ondataavailable = event => { if (!event.data.size || failure) return; if (encodedBytes + event.data.size > PROJECTOR_MAX_ENCODED_BYTES) { failure = Error('PROJECTOR_ENCODED_BYTE_LIMIT'); chunks.length = 0; if (recorder!.state !== 'inactive') recorder!.stop(); resolveStopped(); return; } encodedBytes += event.data.size; chunks.push(event.data); };
    recorder.onstart = () => { actualMime = recorder!.mimeType || mime; };
    recorder.onerror = () => { failure = Error('PROJECTOR_ENCODER_FAILED'); resolveStopped(); };
    recorder.onstop = () => resolveStopped(); recorder.start(500); let elapsed = 0;
    for (let index = 0; index < pages.length; index++) {
      checkProjectorCurrent(guard); if (failure) throw failure;
      const page = pages[index]!; if (index) await paintProjectorPage(pageCanvas, page, prepared); checkProjectorCurrent(guard);
      const buffer = page.asset ? buffers.get(page.asset.key) : undefined;
      let audioEnded: Promise<void> | undefined;
      if (buffer && audioContext && destination) { currentAudio = audioContext.createBufferSource(); currentAudio.buffer = buffer; currentAudio.connect(destination); audioEnded = new Promise(resolve => { currentAudio!.onended = () => resolve(); }); currentAudio.start(); }
      const started = performance.now(), duration = durations[index]! * 1000;
      do { checkProjectorCurrent(guard); if (failure) throw failure; ctx.drawImage(pageCanvas, 0, 0); onProgress?.(Math.min(1, (elapsed + (performance.now() - started) / 1000) / total)); await projectorWait(1000 / 24, guard.signal); } while (performance.now() - started < duration);
      // Wall time can run ahead of the audio rendering clock. Do not cut a kept voice note short.
      if (audioEnded) await awaitProjector(audioEnded, guard.signal, 8000);
      currentAudio?.disconnect(); if (currentAudio) currentAudio.onended = null; currentAudio = undefined; elapsed += durations[index]!;
    }
    // Give the audio encoder its final packets while keeping a valid final video frame.
    if (buffers.size) for (let drain = 0; drain < 6; drain++) { checkProjectorCurrent(guard); if (failure) throw failure; ctx.drawImage(pageCanvas, 0, 0); await projectorWait(50, guard.signal); }
    recorder.stop();
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    try { await awaitProjector(Promise.race([stopped, new Promise<never>((_, reject) => { stopTimer = setTimeout(() => reject(Error('PROJECTOR_ENCODER_STOP_TIMEOUT')), 8000); })]), guard.signal); } finally { if (stopTimer) clearTimeout(stopTimer); }
    checkProjectorCurrent(guard); if (failure) throw failure;
    const blob = new Blob(chunks, { type: actualMime }); if (!blob.size) throw Error('PROJECTOR_EMPTY_FILM'); onProgress?.(1);
    return { blob, filename: `our-kept-story.${actualMime.startsWith('video/mp4') ? 'mp4' : 'webm'}`, kind: 'film', mimeType: actualMime };
  } finally {
    try { currentAudio?.stop(); } catch { /* An already ended/failed source still needs the rest of cleanup. */ } if (currentAudio) currentAudio.onended = null; currentAudio?.disconnect();
    if (recorder) { recorder.ondataavailable = null; recorder.onstart = null; recorder.onerror = null; recorder.onstop = null; if (recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* Always stop the source tracks as well. */ } } }
    stream?.getTracks().forEach(track => track.stop()); if (audioContext && audioContext.state !== 'closed') await audioContext.close(); canvas.width = 0; canvas.height = 0; pageCanvas.width = 0; pageCanvas.height = 0;
  }
}
