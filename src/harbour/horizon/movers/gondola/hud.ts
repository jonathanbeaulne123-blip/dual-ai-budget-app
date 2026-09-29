/**
 * The cable rides' words and controls (pass 5, T3).
 *
 * - The offer at a platform is the threshold's own `action` ("Ride the gondola ↑ Summit Commons", `route.ts`),
 *   so the Horizon's offer row shows it unchanged.
 * - While riding, `cableHud` fills the one bubble the stage already draws: `place` with action 'gate' is the
 *   non-interactive "↑ Summit Commons · 312 m" bubble; `label` says what is happening.
 * - The skip and (gondola) seat controls are `cableControls`: E skips, Space sits or stands; `mountCableHud` is a
 *   small DOM row of real buttons (keyboard reachable) with a polite live region that announces boarding and
 *   arrival, for the stage to mount beside its offer row. The runtime's status line also reads the arrival (the
 *   final frame's fade label).
 * No money, no clock of its own.
 */
import type {MoverHud} from '../shared/mode.ts';
import {rideLabel, type CableKind, type CableLines, type CableRoute, type CableStation} from './route.ts';

/** The subset of the controller state the HUD reads (`controller.ts CableRideState`). */
export interface CableHudState { progress:number; remaining:number; seated:boolean; arrived:boolean; cut:boolean; to:CableStation|null; from:CableStation|null }

export const arrivalLabel = (kind:CableKind, to:Pick<CableStation, 'name'>|null) => `Arrived at ${to?.name ?? 'the station'} by ${kind}.`;
export const boardingLabel = (lines:CableLines, route:CableRoute) => `${rideLabel(lines, route).replace(/^Ride/, 'Riding')}.`;

/** The status line while riding a cable line (the stage's `RIDING_STATUS` is the board's). */
export function cableRidingStatus(kind:CableKind):string {
  return kind === 'gondola'
    ? 'Riding the gondola. E skips to the next station, Space sits or stands, W A S D walk in the cabin.'
    : 'Riding the funicular. E skips to the next station, W A S D walk in the car.';
}

export function cableHud(_kind:CableKind, route:CableRoute, lines:CableLines, s:CableHudState):MoverHud {
  const to = lines[route.kind].stations[route.to];
  const arrow = route.to > route.from ? '↑' : '↓', name = to?.name ?? 'the next station';
  if (s.arrived || s.progress >= 1) return {pace:null, arc:1, glyph:null, label:arrivalLabel(route.kind, to ?? null)};
  return {pace:null, arc:s.progress, glyph:null, label:boardingLabel(lines, route), place:{label:`${arrow} ${name}`, distance:Math.round(s.remaining), action:'gate'}};
}

export type CableControlId = 'skip'|'seat';
export interface CableControl { id:CableControlId; label:string; key:string; pressed?:boolean }
/** The controls a rider has now: skip always (until arrival); the seat on the gondola only. */
export function cableControls(kind:CableKind, s:CableHudState):CableControl[] {
  if (s.arrived) return [];
  const out:CableControl[] = [{id:'skip', label:`Skip to ${s.to?.name ?? 'the next station'}`, key:'E'}];
  if (kind === 'gondola' && !s.cut) out.push({id:'seat', label:s.seated ? 'Stand up' : 'Sit down', key:'Space', pressed:s.seated});
  return out;
}

/** What the HUD needs from the live ride (the active controller, or null when not riding a cable line). */
export interface CableHudSource { ride():{kind:CableKind; state():CableHudState & {route:CableRoute|null}; skip():void; toggleSeat():boolean}|null; lines():CableLines; focus?():void }
/**
 * A DOM row: "Skip to Summit Commons (E)" and "Sit down / Stand up (Space)" buttons plus a polite live region.
 * `update()` once per frame or on the stage's throttled tick; it only touches the DOM when the words change.
 */
export function mountCableHud(host:HTMLElement, source:CableHudSource):{update():void; dispose():void} {
  const root = document.createElement('div');
  root.className = 'horizon-cable-controls'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Cable ride'); root.hidden = true;
  const live = document.createElement('p');
  live.className = 'horizon-cable-announce'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  host.append(root, live);
  let key = '', riding:string|null = null, lastTo:CableStation|null = null, lastKind:CableKind|null = null;
  function render(controls:CableControl[]) {
    root.replaceChildren(...controls.map(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = `${c.label} `; b.dataset.control = c.id;
      const k = document.createElement('span'); k.setAttribute('aria-hidden', 'true'); k.textContent = c.key; b.append(k);
      b.setAttribute('aria-keyshortcuts', c.key === 'Space' ? 'Space' : c.key);
      if (c.pressed !== undefined) b.setAttribute('aria-pressed', String(c.pressed));
      b.addEventListener('click', () => { const r = source.ride(); if (!r) return; if (c.id === 'skip') r.skip(); else r.toggleSeat(); update(); source.focus?.(); });
      return b;
    }));
  }
  function update() {
    const r = source.ride(), s = r?.state() ?? null;
    const id = r && s?.route ? `${r.kind}:${s.route.from}>${s.route.to}` : null;
    if (id !== riding) {
      if (id && r && s?.route) live.textContent = boardingLabel(source.lines(), s.route);
      else if (riding && lastTo && lastKind) live.textContent = arrivalLabel(lastKind, lastTo);
      riding = id;
    }
    if (r && s) { lastTo = s.to; lastKind = r.kind; if (s.arrived) live.textContent = arrivalLabel(r.kind, s.to); }
    const controls = r && s ? cableControls(r.kind, s) : [];
    const next = JSON.stringify(controls);
    if (next !== key) { key = next; render(controls); root.hidden = controls.length === 0; }
  }
  return {update, dispose() { root.remove(); live.remove(); }};
}
