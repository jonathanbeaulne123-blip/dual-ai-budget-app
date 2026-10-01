/** Local, allowlisted evidence for the Horizon Inspector. Never pass application stores here. */
export type DiagnosticValue = string | number | boolean | null;
export type DiagnosticSnapshot = {
  scene: 'horizon' | 'journey' | 'other'; view: string; activity: string;
  worldRevision: string | null; renderedRevision: string | null;
  player: { x: number; y: number; z: number } | null;
  camera: { x: number; y: number; z: number; target: [number, number, number] | null; mode: string; owner: string; transitioning: boolean } | null;
  location: string; movement: Record<string, DiagnosticValue>; interaction: Record<string, DiagnosticValue>;
  context: Record<string, DiagnosticValue>; rendering: Record<string, DiagnosticValue>;
  frame: number | null; frameMs: number | null; drawCalls: number | null; triangles: number | null;
  frameTimes?: number[];
  warnings?: string[];
  idle: boolean; paused: boolean;
};
export type DiagnosticEvent = { at: string; elapsedMs: number; kind: string; action: string; outcome: string; reason?: string; count: number };
export type DiagnosticSample = { elapsedMs: number; frame: number | null; frameMs: number | null; scene: string; activity: string };
export type DiagnosticPin = { at: string; check: string; snapshot: DiagnosticSnapshot };
export type DiagnosticHit = { id: string; owner: string; transform: string; target: string };
export type DiagnosticVisual = { id: 'ground' | 'movement' | 'camera'; x: number; y: number; x2?: number; y2?: number };
export type DiagnosticProvider = { read: () => DiagnosticSnapshot; inspect?: (clientX: number, clientY: number) => DiagnosticHit | null; visuals?: () => DiagnosticVisual[] };
export type Incident = { schemaVersion: 1; id: string; at: string; elapsedMs: number; build: string; viewport: { width: number; height: number; pixelRatio: number }; recorder: { windowSeconds: number; sampleMsAverage: number | null; sampleMsMax: number | null; overlayRenderMsAverage: number | null }; snapshot: DiagnosticSnapshot; events: DiagnosticEvent[]; samples: DiagnosticSample[]; pins: DiagnosticPin[]; recording: boolean; historyAvailable: boolean; description: string; image: Blob | null; maskedImage: Blob | null; imageAt: string | null; imageStatus: string };

const started = performance.now();
const devDefault = import.meta.env.DEV || import.meta.env.MODE === 'test';
const stored = (() => { try { return localStorage.getItem('hearth:inspector-recording'); } catch { return null; } })();
let recording = stored === null ? devDefault : stored === 'on';
let provider: DiagnosticProvider | null = null;
let latest: DiagnosticSnapshot | null = null;
let events: DiagnosticEvent[] = [];
let samples: DiagnosticSample[] = [];
let pins: DiagnosticPin[] = [];
let windowMs = 45_000;
let activeChecks = new Set<string>();
let sampleCount = 0, sampleTotalMs = 0, sampleMaxMs = 0, overlayCount = 0, overlayTotalMs = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const fn of listeners) fn(); };
const clean = (value: string, length = 100) => value.replace(/https?:\/\/\S+/gi, '[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').replace(/(?:bearer\s+)?[A-Za-z0-9_-]{28,}/gi, '[redacted]').slice(0, length);
function trim(now: number) { events = events.filter(e => now - e.elapsedMs <= windowMs).slice(-180); samples = samples.filter(s => now - s.elapsedMs <= windowMs).slice(-120); }
export function subscribeDiagnostics(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function recordOverlayRender(ms: number) { if (Number.isFinite(ms) && ms >= 0) { overlayCount++; overlayTotalMs += ms; } }
export function diagnosticOverhead() { return { sampleMsAverage: sampleCount ? sampleTotalMs / sampleCount : null, sampleMsMax: sampleCount ? sampleMaxMs : null, overlayRenderMsAverage: overlayCount ? overlayTotalMs / overlayCount : null }; }
export function registerDiagnosticProvider(next: DiagnosticProvider) { provider = next; emit(); return () => { if (provider === next) { provider = null; latest = null; emit(); } }; }
export function inspectDiagnostic(clientX: number, clientY: number) { try { return provider?.inspect?.(clientX, clientY) ?? null; } catch { return null; } }
export function diagnosticVisuals() { try { return provider?.visuals?.() ?? []; } catch { return []; } }
export function diagnosticsRecording() { return recording; }
export function setDiagnosticsRecording(next: boolean) { recording = next; if (!next) { events = []; samples = []; pins = []; activeChecks.clear(); } try { localStorage.setItem('hearth:inspector-recording', next ? 'on' : 'off'); } catch { /* session-only */ } emit(); }
export function setDiagnosticsWindow(seconds: number) { if (!Number.isFinite(seconds)) return; windowMs = Math.max(15, Math.min(120, Math.round(seconds))) * 1000; trim(performance.now() - started); emit(); }
export function diagnosticsWindow() { return windowMs / 1000; }
export function recordDiagnostic(kind: string, action: string, outcome: string, reason?: string) {
  if (!recording) return;
  const elapsedMs = performance.now() - started, at = new Date().toISOString();
  const entry = { at, elapsedMs, kind: clean(kind, 32), action: clean(action), outcome: clean(outcome, 80), ...(reason ? { reason: clean(reason) } : {}), count: 1 };
  const previous = events.at(-1);
  if (previous && elapsedMs - previous.elapsedMs < 5000 && previous.kind === entry.kind && previous.action === entry.action && previous.outcome === entry.outcome && previous.reason === entry.reason) { previous.count++; previous.at = at; previous.elapsedMs = elapsedMs; }
  else events.push(entry);
  trim(elapsedMs); emit();
}
export function diagnosticChecks(s: DiagnosticSnapshot): string[] {
  const checks: string[] = [];
  if (s.player && ![s.player.x, s.player.y, s.player.z].every(Number.isFinite)) checks.push('Non-finite player position');
  if (s.camera && (![s.camera.x, s.camera.y, s.camera.z].every(Number.isFinite) || s.camera.target && !s.camera.target.every(Number.isFinite))) checks.push('Non-finite camera pose');
  if (s.worldRevision && s.renderedRevision && s.worldRevision !== s.renderedRevision) checks.push('Map/world revision mismatch');
  if (Number(s.rendering.assetFailures) > 0) checks.push('Unresolved asset failures');
  if (Number(s.rendering.transitionMs) > 10_000) checks.push('Camera transition exceeds 10 seconds');
  return checks;
}
export function sampleDiagnostics() {
  if (!provider) return;
  const began = performance.now();
  try {
    const current = provider.read(); latest = current;
    const checks = new Set(diagnosticChecks(current)); for (const warning of checks) if (!activeChecks.has(warning)) { recordDiagnostic('check', warning, 'triggered'); if (recording) pins.push({ at: new Date().toISOString(), check: warning, snapshot: structuredClone(current) }); } pins = pins.slice(-3); activeChecks = checks;
    if (recording) { const elapsedMs = performance.now() - started; samples.push({ elapsedMs, frame: current.frame, frameMs: current.frameMs, scene: current.scene, activity: current.activity }); trim(elapsedMs); }
    const duration = performance.now() - began; sampleCount++; sampleTotalMs += duration; sampleMaxMs = Math.max(sampleMaxMs, duration); emit();
  } catch { recordDiagnostic('inspector', 'sample', 'failed', 'Provider unavailable'); }
}
export function diagnosticState() { return { snapshot: latest, events: [...events], samples: [...samples], pins: [...pins], recording, elapsedMs: performance.now() - started, windowSeconds: windowMs / 1000, overhead: diagnosticOverhead() }; }
export function captureDiagnosticIncident(build: string): Incident {
  sampleDiagnostics();
  const now = new Date(), current = latest;
  const snapshot: DiagnosticSnapshot = current ?? { scene: 'other', view: 'Not instrumented', activity: 'Not instrumented', worldRevision: null, renderedRevision: null, player: null, camera: null, location: 'Not instrumented', movement: {}, interaction: {}, context: {}, rendering: {}, frame: null, frameMs: null, drawCalls: null, triangles: null, frameTimes: [], idle: true, paused: false };
  const id = `HI-${now.toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
  const incident: Incident = { schemaVersion: 1, id, at: now.toISOString(), elapsedMs: performance.now() - started, build, viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 }, recorder: { windowSeconds: windowMs / 1000, ...diagnosticOverhead() }, snapshot: structuredClone(snapshot), events: structuredClone(events), samples: structuredClone(samples), pins: structuredClone(pins), recording, historyAvailable: recording && (events.length > 0 || samples.length > 0), description: '', image: null, maskedImage: null, imageAt: null, imageStatus: 'Image not captured; attach a manual screenshot if needed. Image and state are not atomic.' };
  recordDiagnostic('incident', 'capture', 'snapshot preserved');
  return incident;
}

/** The default binding accepts only the physical unmodified equals character. */
export function isInspectorKeyCandidate(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey' | 'isComposing' | 'defaultPrevented' | 'target'>, binding = '=') {
  if (event.key !== binding || event.isComposing || event.defaultPrevented || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  const targets = [event.target, typeof document === 'undefined' ? null : document.activeElement];
  return targets.every(target => !(target instanceof Element && (target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="searchbox"],[aria-modal="true"],dialog[open]') || (target as HTMLElement).isContentEditable)));
}
export function isInspectorToggle(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey' | 'repeat' | 'isComposing' | 'defaultPrevented' | 'target'>, binding = '=') { return !event.repeat && isInspectorKeyCandidate(event, binding); }
