// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildInspectorSnapshot, createInspector, formatInspector, frameStats, headingOf, inspectorEnabled, inspectorKey, nearestCorridorStation, type InspectorSource } from '../src/harbour/horizon/runtime/inspector';
import type { Corridor, CorridorSide, CorridorStation } from '../src/harbour/horizon/land/corridor/types';

const side = (paved: number, edge: CorridorSide['edge'] = 'kerb', guard: CorridorSide['guard'] = 'none'): CorridorSide => ({ edge, guard, drop: 0, waterEu: null, paved });
/** A straight road along +x from (100, 5, 200), 2 eu stations; a bridge between s 40 and 60; a closed square ring elsewhere. */
function straight(): Corridor {
  const stations: CorridorStation[] = [];
  for (let s = 0; s <= 100; s += 2) stations.push({ s, at: [100 + s, 5, 200], tangent: [1, 0], grade: 0, context: s >= 40 && s <= 60 ? 'structure' : 'developed', reachId: s < 40 ? 'R1' : s <= 60 ? 'R9' : 'R10', half: 4, left: side(5, 'sidewalk'), right: side(5, s >= 40 && s <= 60 ? 'structure' : 'kerb', s >= 40 && s <= 60 ? 'bridgeRail' : 'none'), ...(s >= 40 && s <= 60 ? { structureId: 'bightBridge' } : {}) });
  return { id: 'V01', closed: false, step: 2, stations, reaches: [], markings: [], guards: [], lamps: [], planting: [], stops: [] };
}
function ring(): Corridor {
  // A closed square 40 × 40 at (500..540, 500..540), counter-clockwise in xz; the seam is between the last and first station.
  const pts: [number, number][] = []; for (let i = 0; i < 20; i++) pts.push([500 + i * 2, 500]); for (let i = 0; i < 20; i++) pts.push([540, 500 + i * 2]); for (let i = 0; i < 20; i++) pts.push([540 - i * 2, 540]); for (let i = 0; i < 20; i++) pts.push([500, 540 - i * 2]);
  const stations = pts.map(([x, z], i): CorridorStation => { const n = pts[(i + 1) % pts.length]!, dx = n[0] - x, dz = n[1] - z, l = Math.hypot(dx, dz); return { s: i * 2, at: [x, 3, z], tangent: [dx / l, dz / l], grade: 0, context: 'open', reachId: 'RING', half: 4, left: side(5, 'shoulder'), right: side(5, 'shoulder') }; });
  return { id: 'VG', closed: true, step: 2, stations, reaches: [], markings: [], guards: [], lamps: [], planting: [], stops: [] };
}

describe('station lookup', () => {
  it('finds the nearest station, interpolates s and signs the offset (+ right of increasing s)', () => {
    // Heading +x, right(t) = (−t.z, t.x) = (0, 1): +z is the right-hand side.
    const hit = nearestCorridorStation([straight(), ring()], 133, 202.5)!;
    expect(hit).toMatchObject({ road: 'V01', s: 33, reach: 'R1', context: 'developed', offset: 2.5, distance: 2.5, side: 'right', onCarriageway: true, structureId: null });
    expect(hit.left).toEqual({ edge: 'sidewalk', guard: 'none', paved: 5, gap: null });
    const left = nearestCorridorStation([straight()], 133, 194)!;
    expect(left.offset).toBe(-6); expect(left.side).toBe('left'); expect(left.onCarriageway).toBe(false);
  });
  it('reports the structure that owns the road and the guard on each side', () => {
    const hit = nearestCorridorStation([straight()], 150.2, 199)!;
    expect(hit).toMatchObject({ reach: 'R9', context: 'structure', structureId: 'bightBridge' });
    expect(hit.right).toMatchObject({ edge: 'structure', guard: 'bridgeRail' });
  });
  it('wraps s across a closed corridor\'s seam', () => {
    const hit = nearestCorridorStation([ring()], 499, 501)!;   // between the last station (500, 502) and the first (500, 500)
    expect(hit.road).toBe('VG'); expect(hit.s).toBeGreaterThan(158); expect(hit.s).toBeLessThanOrEqual(160);
    const start = nearestCorridorStation([ring()], 501, 499)!;
    expect(start.s).toBeCloseTo(1, 6);
  });
  it('says so when there is no corridor, or none near', () => {
    expect(nearestCorridorStation(undefined, 0, 0)).toBeNull(); expect(nearestCorridorStation([straight()], 900, 900)).toBeNull();
  });
});

function source(over: Partial<InspectorSource> = {}): InspectorSource {
  return {
    tier: 'full', sha: 'abc1234',
    body: () => ({ x: 140.123, y: 5.004, z: 201, yaw: Math.PI / 2 }), mode: () => 'walk', perspective: () => 'activity', mover: () => 'cruiser',
    motion: () => ({ speed: 12.5, grounded: true, contact: null }),
    surface: (x, z) => ({ id: 'V01.bed@harbour', y: 5, material: 'paved', slope: 1.2, x, z } as never),
    solid: id => id.startsWith('V01') ? { role: 'deck', kind: 'road', surface: 'paved' } : null,
    corridors: () => [straight()],
    frames: () => [...Array.from({ length: 200 }, () => 100), ...Array.from({ length: 110 }, () => 16), ...Array.from({ length: 10 }, () => 40)],
    render: () => ({ calls: 211, triangles: 612_000 }), resident: () => ['harbour', 'bight'],
    lights: () => ({ cards: 40, pointLights: 6, pointLightsLit: 3, k: 1 }), blocker: () => ({ at: [1, 2, 3], obstacle: 'V01.kerbs@harbour', surface: null, water: false }),
    clock: () => new Date('2026-06-21T22:30:00Z'), ...over,
  };
}
describe('the snapshot', () => {
  it('carries position, heading, mode, speed, surface, station, frame percentiles, render, residency, lights and the blocker', () => {
    const snap = buildInspectorSnapshot(source(), new Date('2026-09-29T12:00:00Z'));
    expect(snap.position).toEqual({ x: 140.12, y: 5, z: 201 });
    expect(snap.heading).toEqual({ degrees: 90, compass: 'E' });   // yaw π/2 → forward +x → east
    expect(snap).toMatchObject({ mode: 'walk', perspective: 'activity', mover: 'cruiser', grounded: true, tier: 'full', sha: 'abc1234', time: '2026-09-29T12:00:00.000Z', clock: '2026-06-21T22:30:00.000Z' });
    expect(snap.speed).toEqual({ ms: 12.5, kmh: 45 });
    expect(snap.surface).toMatchObject({ id: 'V01.bed@harbour', kind: 'solid', role: 'deck', solidKind: 'road', material: 'paved', y: 5 });
    expect(snap.station).toMatchObject({ road: 'V01', s: 40.12, reach: 'R9', offset: 1, side: 'right', structureId: 'bightBridge' });
    // Only the last 120 frames count: 110 × 16 ms and 10 × 40 ms (the 100 ms frames are older).
    expect(snap.frame).toEqual({ p50: 16, p95: 40, samples: 120 });
    expect(snap.render).toEqual({ calls: 211, triangles: 612_000 }); expect(snap.resident).toEqual({ count: 2, ids: ['bight', 'harbour'] });
    expect(snap.lights).toMatchObject({ pointLightsLit: 3 });
    expect(snap.blocker).toEqual({ walk: { at: [1, 2, 3], obstacle: 'V01.kerbs@harbour', surface: null, water: false }, contact: null });
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    const text = formatInspector(snap);
    expect(text.join('\n')).toContain('V01 s 40.1 · R9 · structure · bightBridge');
    expect(text.join('\n')).toContain('p50 16 p95 40');
  });
  it('says "no corridor" when the world has none, and reads terrain as terrain', () => {
    const snap = buildInspectorSnapshot(source({ corridors: () => undefined, surface: () => ({ id: 'terrain', y: 2, material: 'grass', slope: 4 }), motion: () => ({ speed: null, grounded: null }) }));
    expect(snap.station).toEqual({ none: 'no corridor' }); expect(snap.surface).toMatchObject({ kind: 'terrain', role: null }); expect(snap.speed).toBeNull();
    expect(formatInspector(snap)[3]).toBe('no corridor');
  });
  it('frame percentiles and headings', () => {
    expect(frameStats([])).toEqual({ p50: null, p95: null, samples: 0 });
    expect(frameStats([10, 20, 30, 40])).toMatchObject({ p50: 30, samples: 4 });
    expect(headingOf(Math.PI).compass).toBe('N'); expect(headingOf(0).compass).toBe('S'); expect(headingOf(-Math.PI / 2).compass).toBe('W');
  });
});

describe('keys and the overlay (D-R6)', () => {
  it('maps = to toggle and + / Shift+= to copy; ignores modified keys', () => {
    const k = (key: string, code: string, shiftKey = false, ctrlKey = false) => inspectorKey({ key, code, shiftKey, ctrlKey, metaKey: false, altKey: false });
    expect(k('=', 'Equal')).toBe('toggle'); expect(k('+', 'Equal', true)).toBe('copy'); expect(k('+', 'NumpadAdd')).toBe('copy');
    expect(k('0', 'Equal')).toBe('toggle');   // a layout where the Equal key types something else
    expect(k('=', 'Equal', false, true)).toBeNull(); expect(k('e', 'KeyE')).toBeNull();
  });
  it('is dev-only unless ?diagnostics=1', () => {
    expect(inspectorEnabled('', true)).toBe(true); expect(inspectorEnabled('', false)).toBe(false); expect(inspectorEnabled('?diagnostics=1', false)).toBe(true);
    const host = document.createElement('div'), off = createInspector(host, source(), { enabled: false });
    expect(off.keyDown(new KeyboardEvent('keydown', { key: '=' }))).toBe(false); expect(host.childElementCount).toBe(0);
  });
  it('opens top-left, updates at 4 Hz, copies to the clipboard and the log, closes with Escape', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const host = document.createElement('div'); document.body.appendChild(host);
    let x = 140; const src = source({ body: () => ({ x, y: 5, z: 201, yaw: 0 }) }), focusBack = vi.fn();
    const inspector = createInspector(host, src, { enabled: true, focusBack });
    expect(inspector.keyDown(new KeyboardEvent('keydown', { key: '=', code: 'Equal' }))).toBe(true);
    const panel = host.querySelector<HTMLElement>('.horizon-inspector')!;
    expect(panel.hidden).toBe(false); expect(panel.style.left).toBe('0.5rem'); expect(panel.getAttribute('role')).toBe('region');
    const live = panel.querySelector('[aria-live]')!; expect(live.getAttribute('aria-live')).toBe('off');
    expect(live.textContent).toContain('pos 140.0');
    x = 150; vi.advanceTimersByTime(260); expect(live.textContent).toContain('pos 150.0');
    // Copy: clipboard + log.
    expect(inspector.keyDown(new KeyboardEvent('keydown', { key: '+', code: 'Equal', shiftKey: true }))).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1); expect(JSON.parse((writeText.mock.calls[0] as unknown as [string])[0]).position.x).toBe(150);
    expect(inspector.log).toHaveLength(1);
    panel.querySelector<HTMLButtonElement>('button:nth-of-type(1)')!.click(); expect(inspector.log).toHaveLength(2);
    // Announce toggles polite.
    const box = panel.querySelector<HTMLInputElement>('input[type=checkbox]')!; box.checked = true; box.dispatchEvent(new Event('change')); expect(live.getAttribute('aria-live')).toBe('polite');
    // Escape inside the panel closes it and hands focus back.
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true); expect(focusBack).toHaveBeenCalled();
    x = 170; vi.advanceTimersByTime(1000); expect(live.textContent).not.toContain('pos 170');   // no updates while closed
    inspector.dispose(); expect(host.querySelector('.horizon-inspector')).toBeNull();
    vi.useRealTimers();
  });
});
