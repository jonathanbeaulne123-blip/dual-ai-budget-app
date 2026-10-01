/**
 * The road-specific diagnostic probe (ROAD.md D-R6; brief §9). Development only: mounted when HARBOUR_DEV (a dev build, flag.ts) or the page
 * carries `?diagnostics=1`. The global Horizon Inspector owns the `=` shortcut. This probe remains available through
 * the review runtime API; its Copy button copies a JSON snapshot to the clipboard and appends it to the
 * runtime's `inspectorLog` (`window.__harbour.inspectorLog` in dev) so headless scripts can collect it;
 * `window.__harbour.inspect()` returns the same snapshot. Escape inside the panel closes it and gives focus back.
 * The text refreshes at 4 Hz while open; nothing runs per frame (the runtime's frame ring is read at 4 Hz).
 * The live region is `aria-live="off"` by default; "Announce" turns it to polite.
 */
import type { Corridor, CorridorSide } from '../land/corridor/types.ts';

export interface InspectorSurface { id: string; y: number; material?: string; slope?: number }
export interface InspectorSource {
  body(): { x: number; y: number; z: number; yaw: number };
  /** walk | look | journey. */
  mode(): string;
  perspective(): string;
  /** The active mover (feet, cruiser, board…). */
  mover(): string;
  /** Speed (m/s) and grounded state of the active mover; null fields when not riding. */
  motion(): { speed: number | null; grounded: boolean | null; contact?: string | null };
  surface(x: number, z: number, y: number): InspectorSurface | null;
  /** Role / kind / surface of a solid by id, when the id is a solid. */
  solid?(id: string): { role?: string; kind?: string; surface?: string } | null;
  corridors(): readonly Corridor[] | undefined;
  /** Frame deltas (ms), oldest first; the last 120 are used. */
  frames(): readonly number[];
  render(): { calls: number; triangles: number } | null;
  resident(): readonly string[];
  lights(): Record<string, unknown> | null;
  blocker(): unknown;
  /** The world clock (the sun's date), if known. */
  clock(): Date | null;
  tier: string;
  sha?: string | null;
}
export interface StationHit {
  road: string; s: number; reach: string; context: string; structureId: string | null;
  /** Signed lateral offset from the centreline (+ = right of increasing s), and its magnitude. */
  offset: number; distance: number; side: 'left' | 'right' | 'centre';
  left: { edge: string; guard: string; paved: number; gap: string | null };
  right: { edge: string; guard: string; paved: number; gap: string | null };
  onCarriageway: boolean;
}
export interface InspectorSnapshot {
  time: string; clock: string | null; sha: string | null; tier: string;
  position: { x: number; y: number; z: number }; heading: { degrees: number; compass: string };
  mode: string; perspective: string; mover: string;
  speed: { ms: number; kmh: number } | null; grounded: boolean | null;
  surface: { id: string; kind: 'terrain' | 'solid'; role: string | null; solidKind: string | null; material: string | null; y: number; slope: number | null } | null;
  station: StationHit | { none: string };
  frame: { p50: number | null; p95: number | null; samples: number };
  render: { calls: number; triangles: number } | null;
  resident: { count: number; ids: string[] };
  lights: Record<string, unknown> | null;
  blocker: { walk: unknown; contact: string | null };
}

export const INSPECTOR = { hz: 4, frames: 120, stationReach: 60 } as const;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function inspectorEnabled(search: string, dev: boolean): boolean {
  return dev || new URLSearchParams(search).get('diagnostics') === '1';
}
/** Only an unmodified equals character is a toggle candidate. The global Inspector owns live keyboard input. */
export function inspectorKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): 'toggle' | 'copy' | null {
  return e.key === '=' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey ? 'toggle' : null;
}

/** p50 / p95 of the last `n` frame deltas (ms). */
export function frameStats(frames: readonly number[], n: number = INSPECTOR.frames): { p50: number | null; p95: number | null; samples: number } {
  const tail = frames.slice(-n).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!tail.length) return { p50: null, p95: null, samples: 0 };
  const at = (q: number) => tail[Math.min(tail.length - 1, Math.floor(q * (tail.length - 1) + 0.5))]!;
  return { p50: r2(at(0.5)), p95: r2(at(0.95)), samples: tail.length };
}

const side = (c: CorridorSide) => ({ edge: c.edge, guard: c.guard, paved: r2(c.paved), gap: c.gap ?? null });
/**
 * The nearest corridor station to (x, z): projected onto the centreline segment between consecutive stations (closed
 * corridors include the seam), with `s` interpolated and the signed offset (+ right: right(t) = (−t.z, t.x)).
 * Null when nothing lies within `reach` eu.
 */
export function nearestCorridorStation(corridors: readonly Corridor[] | undefined, x: number, z: number, reach: number = INSPECTOR.stationReach): StationHit | null {
  if (!corridors?.length) return null;
  let best: { c: Corridor; i: number; j: number; t: number; d: number } | null = null;
  for (const c of corridors) {
    const st = c.stations, n = st.length; if (!n) continue;
    const segs = c.closed && n > 1 ? n : Math.max(1, n - 1);
    for (let i = 0; i < segs; i++) {
      const a = st[i]!, j = n > 1 ? (i + 1) % n : i, b = st[j]!;
      const dx = b.at[0] - a.at[0], dz = b.at[2] - a.at[2], l = dx * dx + dz * dz;
      if (Math.min(a.at[0], b.at[0]) - reach > x || Math.max(a.at[0], b.at[0]) + reach < x || Math.min(a.at[2], b.at[2]) - reach > z || Math.max(a.at[2], b.at[2]) + reach < z) continue;
      const t = l > 0 ? Math.max(0, Math.min(1, ((x - a.at[0]) * dx + (z - a.at[2]) * dz) / l)) : 0;
      const d = Math.hypot(x - a.at[0] - dx * t, z - a.at[2] - dz * t);
      if (d <= reach && (!best || d < best.d)) best = { c, i, j, t, d };
    }
  }
  if (!best) return null;
  const { c, i, j, t } = best, a = c.stations[i]!, b = c.stations[j]!, near = t < 0.5 ? a : b;
  const wrap = j < i ? (a.s + c.step) : b.s, s = a.s + (wrap - a.s) * t;
  const px = a.at[0] + (b.at[0] - a.at[0]) * t, pz = a.at[2] + (b.at[2] - a.at[2]) * t;
  let tx = b.at[0] - a.at[0], tz = b.at[2] - a.at[2]; const tl = Math.hypot(tx, tz);
  if (tl > 1e-9) { tx /= tl; tz /= tl; } else { tx = a.tangent[0]; tz = a.tangent[1]; }
  const offset = (x - px) * -tz + (z - pz) * tx, sideOf: StationHit['side'] = Math.abs(offset) < 0.05 ? 'centre' : offset > 0 ? 'right' : 'left';
  const paved = offset >= 0 ? near.right.paved : near.left.paved;
  const length = c.closed ? (c.stations.at(-1)!.s + c.step) : Infinity;
  return { road: c.id, s: r2(c.closed ? ((s % length) + length) % length : s), reach: near.reachId, context: near.context, structureId: near.structureId ?? null,
    offset: r2(offset), distance: r2(Math.abs(offset)), side: sideOf, left: side(near.left), right: side(near.right), onCarriageway: Math.abs(offset) <= paved };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
/** Heading of yaw (forward = (sin yaw, cos yaw) in xz; north is −z): compass degrees clockwise from north. */
export function headingOf(yaw: number): { degrees: number; compass: string } {
  const deg = ((Math.atan2(Math.sin(yaw), -Math.cos(yaw)) * 180 / Math.PI) % 360 + 360) % 360;
  return { degrees: Math.round(deg * 10) / 10, compass: COMPASS[Math.round(deg / 45) % 8]! };
}

export function buildInspectorSnapshot(src: InspectorSource, now: Date = new Date()): InspectorSnapshot {
  const b = src.body(), motion = src.motion(), hit = src.surface(b.x, b.z, b.y + 0.5), render = src.render(), resident = [...src.resident()].sort();
  const solid = hit && hit.id !== 'terrain' ? src.solid?.(hit.id) ?? null : null;
  const station = nearestCorridorStation(src.corridors(), b.x, b.z);
  const clock = src.clock();
  return {
    time: now.toISOString(), clock: clock ? clock.toISOString() : null, sha: src.sha ?? null, tier: src.tier,
    position: { x: r2(b.x), y: r2(b.y), z: r2(b.z) }, heading: headingOf(b.yaw),
    mode: src.mode(), perspective: src.perspective(), mover: src.mover(),
    speed: motion.speed === null ? null : { ms: r2(motion.speed), kmh: r2(motion.speed * 3.6) }, grounded: motion.grounded,
    surface: hit ? { id: hit.id, kind: hit.id === 'terrain' ? 'terrain' : 'solid', role: solid?.role ?? null, solidKind: solid?.kind ?? null, material: solid?.surface ?? hit.material ?? null, y: r2(hit.y), slope: hit.slope === undefined ? null : r2(hit.slope) } : null,
    station: station ?? { none: src.corridors()?.length ? `no corridor within ${INSPECTOR.stationReach} eu` : 'no corridor' },
    frame: frameStats(src.frames()), render: render ? { calls: render.calls, triangles: render.triangles } : null,
    resident: { count: resident.length, ids: resident }, lights: src.lights(),
    blocker: { walk: plain(src.blocker()), contact: motion.contact ?? null },
  };
}
/** Round numbers and drop functions so the blocker is JSON-safe. */
function plain(v: unknown): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? r2(v) : String(v);
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (Array.isArray(v)) return v.map(plain);
  const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') out[k] = plain(x); return out;
}

/** The overlay text (one fact per line). */
export function formatInspector(s: InspectorSnapshot): string[] {
  const st = s.station, lines = [
    `pos ${s.position.x.toFixed(1)} ${s.position.y.toFixed(2)} ${s.position.z.toFixed(1)} · ${s.heading.degrees.toFixed(0)}° ${s.heading.compass}`,
    `${s.mode} · ${s.perspective} · ${s.mover}${s.speed ? ` · ${s.speed.ms.toFixed(1)} m/s` : ''}${s.grounded === null ? '' : s.grounded ? ' · grounded' : ' · airborne'}`,
    `under ${s.surface ? `${s.surface.id}${s.surface.role ? ` (${s.surface.role}${s.surface.material ? `/${s.surface.material}` : ''})` : ''} y ${s.surface.y.toFixed(2)}${s.surface.slope !== null ? ` ${s.surface.slope.toFixed(0)}°` : ''}` : 'nothing'}`,
    'none' in st ? st.none : `${st.road} s ${st.s.toFixed(1)} · ${st.reach} · ${st.context}${st.structureId ? ` · ${st.structureId}` : ''}`,
  ];
  if (!('none' in st)) lines.push(`off centre ${st.offset.toFixed(2)} (${st.side})${st.onCarriageway ? '' : ' OFF ROAD'} · L ${st.left.edge}/${st.left.guard} · R ${st.right.edge}/${st.right.guard}`);
  lines.push(`frame p50 ${s.frame.p50 ?? '–'} p95 ${s.frame.p95 ?? '–'} ms · ${s.render ? `${s.render.calls} calls ${(s.render.triangles / 1000).toFixed(0)}k tris` : 'no render'}`);
  const l = s.lights as { cards?: number; pointLightsLit?: number; pointLights?: number; k?: number } | null;
  lines.push(`districts ${s.resident.count} · lights ${l ? `${l.cards ?? 0} cards, ${l.pointLightsLit ?? 0}/${l.pointLights ?? 0} point, k ${(l.k ?? 0).toFixed(2)}` : '–'}`);
  const walk = s.blocker.walk as { obstacle?: string | null; surface?: { id?: string } | null } | null;
  lines.push(`blocker ${s.blocker.contact ?? (walk ? walk.obstacle ?? walk.surface?.id ?? 'yes' : 'none')}`);
  return lines;
}

export interface Inspector {
  readonly enabled: boolean;
  readonly log: InspectorSnapshot[];
  open(): boolean;
  toggle(): boolean;
  close(): void;
  snapshot(): InspectorSnapshot;
  copy(): InspectorSnapshot;
  /** Review API only; the global Inspector handles page keyboard input. */
  keyDown(e: KeyboardEvent): boolean;
  dispose(): void;
}
export function createInspector(host: HTMLElement, source: InspectorSource, options: { enabled: boolean; focusBack?: () => void }): Inspector {
  const log: InspectorSnapshot[] = [];
  if (!options.enabled) return { enabled: false, log, open: () => false, toggle: () => false, close() {}, snapshot: () => buildInspectorSnapshot(source), copy: () => buildInspectorSnapshot(source), keyDown: () => false, dispose() {} };
  let panel: HTMLElement | null = null, text: HTMLElement | null = null, status: HTMLElement | null = null, timer = 0, isOpen = false;
  function build() {
    const doc = host.ownerDocument;
    panel = doc.createElement('section'); panel.className = 'horizon-road-inspector'; panel.tabIndex = 0;
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Horizon road probe');
    Object.assign(panel.style, { boxSizing: 'border-box', position: 'absolute', left: '.5rem', top: 'var(--horizon-toolbar-bottom, 4.5rem)', zIndex: '6', maxWidth: 'min(24rem, calc(100% - 1rem))', maxHeight: '45%', overflow: 'auto',
      padding: '.4rem .55rem', borderRadius: '.5rem', background: 'rgba(20,28,34,.84)', color: '#f3ecd9', font: '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', boxShadow: '0 4px 16px #0006', pointerEvents: 'auto' } as Partial<CSSStyleDeclaration>);
    const bar = doc.createElement('div'); Object.assign(bar.style, { display: 'flex', gap: '.35rem', alignItems: 'center', marginBottom: '.25rem', flexWrap: 'wrap' });
    const title = doc.createElement('strong'); title.textContent = 'Inspector'; title.style.marginRight = 'auto';
    const button = (label: string, act: () => void) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; Object.assign(b.style, { font: 'inherit', padding: '.1rem .45rem', borderRadius: '.3rem', border: '1px solid #f3ecd955', background: '#f3ecd922', color: 'inherit', cursor: 'pointer', minHeight: '24px' }); b.addEventListener('click', act); return b; };
    const announce = doc.createElement('label'); Object.assign(announce.style, { display: 'inline-flex', gap: '.2rem', alignItems: 'center' });
    const box = doc.createElement('input'); box.type = 'checkbox'; box.addEventListener('change', () => text?.setAttribute('aria-live', box.checked ? 'polite' : 'off'));
    announce.append(box, doc.createTextNode('Announce'));
    bar.append(title, announce, button('Copy', () => { copy(); }), button('Close', () => { close(); options.focusBack?.(); }));
    text = doc.createElement('div'); text.setAttribute('aria-live', 'off'); text.style.whiteSpace = 'pre-wrap'; text.style.wordBreak = 'break-word';
    status = doc.createElement('div'); status.setAttribute('role', 'status'); status.style.opacity = '.8';
    panel.append(bar, text, status);
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); options.focusBack?.(); return; }
      const k = inspectorKey(e); if (!k) return; e.preventDefault(); e.stopPropagation(); if (k === 'copy') copy(); else { close(); options.focusBack?.(); }
    });
    host.appendChild(panel);
  }
  function paint() { if (text) text.textContent = formatInspector(buildInspectorSnapshot(source)).join('\n'); }
  function open() { if (!panel) build(); panel!.hidden = false; isOpen = true; paint(); window.clearInterval(timer); timer = window.setInterval(paint, 1000 / INSPECTOR.hz); return true; }
  function close() { isOpen = false; window.clearInterval(timer); timer = 0; if (panel) panel.hidden = true; }
  function copy(): InspectorSnapshot {
    const snap = buildInspectorSnapshot(source), json = JSON.stringify(snap, null, 2);
    log.push(snap); if (log.length > 500) log.shift();
    const said = (m: string) => { if (status) status.textContent = m; };
    try {
      const clip = navigator.clipboard;
      if (clip?.writeText) clip.writeText(json).then(() => said(`Copied snapshot ${log.length}.`), () => said(`Logged snapshot ${log.length} (clipboard refused).`));
      else said(`Logged snapshot ${log.length} (no clipboard).`);
    } catch { said(`Logged snapshot ${log.length} (clipboard refused).`); }
    return snap;
  }
  return {
    enabled: true, log,
    open, close, copy,
    toggle() { if (isOpen) { close(); return false; } return open(); },
    snapshot: () => buildInspectorSnapshot(source),
    keyDown(e) {
      // Escape on the stage closes an open panel and still reaches the runtime (it also clears a walk route).
      if (e.key === 'Escape') { if (isOpen) close(); return false; }
      const k = inspectorKey(e); if (!k) return false; e.preventDefault(); if (k === 'copy') copy(); else if (isOpen) close(); else open(); return true; },
    dispose() { close(); panel?.remove(); panel = text = status = null; },
  };
}
